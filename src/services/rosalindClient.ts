import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://rosalind.info';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface SubmissionForm {
  action: string;
  hiddenFields: Record<string, string>;
  outputFieldName: string;
}

export interface SubmissionResult {
  correct: boolean;
  message: string;
}

export class RosalindClient {
  private http: AxiosInstance;

  constructor(public readonly jar: CookieJar) {
    this.http = wrapper(
      axios.create({
        baseURL: BASE_URL,
        jar,
        withCredentials: true,
        maxRedirects: 5,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9'
        },
        validateStatus: (status) => status >= 200 && status < 400
      })
    );
  }

  private async getCsrfToken(path: string): Promise<string> {
    await this.http.get(path);
    const cookies = await this.jar.getCookies(BASE_URL);
    const csrf = cookies.find((c) => c.key === 'csrftoken');
    if (!csrf) {
      throw new Error('Missing csrftoken cookie after GET ' + path);
    }
    return csrf.value;
  }

  async login(username: string, password: string): Promise<void> {
    const loginPath = '/accounts/login/';
    const getResp = await this.http.get(loginPath);
    const $ = cheerio.load(getResp.data);
    const formToken = $('#id_form_login input[name="csrfmiddlewaretoken"]').attr(
      'value'
    );
    const cookies = await this.jar.getCookies(BASE_URL);
    const csrfCookie = cookies.find((c) => c.key === 'csrftoken')?.value;
    const token = formToken || csrfCookie;
    if (!token) {
      throw new Error('Could not extract CSRF token from login page.');
    }

    const body = new URLSearchParams();
    body.set('csrfmiddlewaretoken', token);
    body.set('next', '');
    body.set('username', username);
    body.set('password', password);

    const resp = await this.http.post(loginPath, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: BASE_URL + loginPath,
        Origin: BASE_URL
      }
    });

    const html: string = typeof resp.data === 'string' ? resp.data : '';
    if (html.includes('id_form_login') || html.includes('Please correct the')) {
      throw new Error('Invalid username or password.');
    }
  }

  async isLoggedIn(): Promise<boolean> {
    const resp = await this.http.get('/');
    const html: string = typeof resp.data === 'string' ? resp.data : '';
    return /\/users\/profile\/|\/accounts\/logout\//.test(html);
  }

  async getProblem(slug: string): Promise<string> {
    const resp = await this.http.get(`/problems/${slug}/`);
    return resp.data as string;
  }

  async getDataset(slug: string): Promise<string> {
    const resp = await this.http.get(`/problems/${slug}/dataset/`, {
      responseType: 'text',
      transformResponse: [(data) => data]
    });
    return String(resp.data);
  }

  async submit(
    slug: string,
    form: SubmissionForm,
    output: string
  ): Promise<string> {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(form.hiddenFields)) {
      body.set(k, v);
    }
    body.set(form.outputFieldName, output);

    const actionUrl = form.action.startsWith('http')
      ? form.action
      : BASE_URL + form.action;

    const resp = await this.http.post(actionUrl, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${BASE_URL}/problems/${slug}/`,
        Origin: BASE_URL
      }
    });
    return resp.data as string;
  }
}
