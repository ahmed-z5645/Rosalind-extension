import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import { log } from './logger';

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
    this.http = axios.create({
      baseURL: BASE_URL,
      maxRedirects: 5,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9'
      },
      // Force axios to follow redirects to a 2xx — if we treat 3xx as
      // success, axios resolves on the 302 with an empty body.
      validateStatus: (status) => status >= 200 && status < 300
    });

    // axios-cookiejar-support@5 doesn't speak tough-cookie@5; pump cookies
    // through the jar manually instead.
    this.http.interceptors.request.use(async (config) => {
      const url = new URL(
        config.url || '/',
        config.baseURL || BASE_URL
      ).toString();
      const cookieString = await jar.getCookieString(url);
      if (cookieString) {
        const headers =
          config.headers ?? ({} as InternalAxiosRequestConfig['headers']);
        (headers as Record<string, string>)['Cookie'] = cookieString;
        config.headers = headers;
      }
      return config;
    });

    this.http.interceptors.response.use(async (response) => {
      const setCookie = response.headers['set-cookie'];
      if (Array.isArray(setCookie) && setCookie.length > 0) {
        const respUrl = new URL(
          response.config.url || '/',
          response.config.baseURL || BASE_URL
        ).toString();
        for (const sc of setCookie) {
          try {
            await jar.setCookie(sc, respUrl);
          } catch {
            /* ignore parse errors */
          }
        }
      }
      return response;
    });
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
    // /problems/list-view/ is a stable 200 (no redirects) for both anon and
    // authed users. Anon shows id="menu_login"; authed shows id="menu_profile".
    const url = '/problems/list-view/';
    const cookiesForUrl = await this.jar.getCookies('https://rosalind.info' + url);
    log(
      'isLoggedIn: GET',
      url,
      'jar cookies:',
      cookiesForUrl.map((c) => `${c.key}=${c.value.slice(0, 6)}…(${c.value.length})`).join(', ') || '(none)'
    );
    const resp = await this.http.get(url);
    const html: string = typeof resp.data === 'string' ? resp.data : '';
    const hasMenuLogin = /id="menu_login"/i.test(html);
    const hasMenuProfile = /id="menu_profile"/i.test(html);
    log(
      'isLoggedIn: status',
      resp.status,
      'bodyLen',
      html.length,
      'hasMenuLogin',
      hasMenuLogin,
      'hasMenuProfile',
      hasMenuProfile,
      'requestSentCookie',
      (resp.config?.headers as Record<string, unknown> | undefined)?.['Cookie'] ?? resp.request?._header?.match?.(/Cookie:[^\r\n]*/)?.[0] ?? '(unknown)'
    );
    if (html.length === 0) return false;
    return !hasMenuLogin;
  }

  /**
   * Inject a sessionid cookie obtained from the user's browser. Lets users who
   * sign in via Google / OpenID skip the password-form flow entirely.
   */
  async setSessionCookie(sessionid: string): Promise<void> {
    const tenYears = 60 * 60 * 24 * 365 * 10;
    const cookieString = `sessionid=${sessionid.trim()}; Path=/; Max-Age=${tenYears}`;
    const cookie = await this.jar.setCookie(cookieString, BASE_URL);
    log(
      'setSessionCookie: stored',
      cookie ? `${cookie.key}=${cookie.value.slice(0, 6)}…(${cookie.value.length})` : '(null)',
      'domain:',
      cookie?.domain,
      'path:',
      cookie?.path
    );
  }

  async getProblemList(): Promise<string> {
    const resp = await this.http.get('/problems/list-view/');
    return resp.data as string;
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
