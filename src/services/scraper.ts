import * as cheerio from 'cheerio';
import type { SubmissionForm, SubmissionResult } from './rosalindClient';

const PROBLEM_HEADER_ID = 'problem';

export interface ProblemEntry {
  slug: string;
  title: string;
}

export function extractProblemList($: cheerio.CheerioAPI): ProblemEntry[] {
  const seen = new Set<string>();
  const results: ProblemEntry[] = [];
  const SKIP = new Set(['list-view', 'list', 'locations', 'datasets', 'leaderboard']);

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const m = href.match(/^\/problems\/([a-z0-9]+)\/?$/);
    if (!m) return;
    const slug = m[1];
    if (SKIP.has(slug) || seen.has(slug)) return;
    const title = $(el).text().trim();
    if (!title) return;
    seen.add(slug);
    results.push({ slug, title });
  });
  return results;
}

export function extractTitle($: cheerio.CheerioAPI): string {
  const raw = $('title').text().trim();
  return raw.replace(/^ROSALIND\s*\|\s*/, '');
}

export function extractProblemHtml($: cheerio.CheerioAPI): string | null {
  // Problem task + sample dataset/output (helpful to keep alongside).
  const start = $(`#${PROBLEM_HEADER_ID}`).first();
  if (start.length === 0) return null;

  const collected: string[] = [];
  let node = start.nextAll();
  node.each((_, el) => {
    collected.push($.html(el) || '');
  });
  return collected.join('\n');
}

export function extractBioContextHtml($: cheerio.CheerioAPI): string | null {
  // Collect every sibling node that comes BEFORE <h2 id="problem">.
  // This works regardless of what the bio section's own H2 id is.
  const problemHeader = $(`#${PROBLEM_HEADER_ID}`).first();
  if (problemHeader.length === 0) return null;

  const collected: string[] = [];
  let node = problemHeader.prev();
  while (node.length > 0) {
    collected.unshift($.html(node) || '');
    node = node.prev();
  }

  const joined = collected.join('\n').trim();
  return joined.length > 0 ? joined : null;
}

export function extractSubmissionForm(
  $: cheerio.CheerioAPI,
  slug: string
): SubmissionForm | null {
  // Find a form whose action targets this problem (typically /problems/<slug>/).
  let match: cheerio.Cheerio<any> | null = null;
  $('form').each((_, el) => {
    const $el = $(el);
    const action = ($el.attr('action') || '').trim();
    if (
      action.includes(`/problems/${slug}`) ||
      $el.find('textarea[name*="output"], input[type="file"][name*="output"]').length > 0
    ) {
      match = $el;
      return false;
    }
    return undefined;
  });
  if (!match) return null;
  const $form = match as unknown as cheerio.Cheerio<any>;

  const action = ($form.attr('action') || `/problems/${slug}/`).trim();
  const hiddenFields: Record<string, string> = {};
  $form.find('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const value = $(el).attr('value') || '';
    if (name) hiddenFields[name] = value;
  });

  // Prefer textarea; fall back to first non-hidden input named like output.
  let outputFieldName: string | undefined;
  const ta = $form.find('textarea').first();
  if (ta.length > 0 && ta.attr('name')) {
    outputFieldName = ta.attr('name');
  }
  if (!outputFieldName) {
    $form.find('input').each((_, el) => {
      const name = $(el).attr('name');
      const type = ($(el).attr('type') || 'text').toLowerCase();
      if (
        name &&
        type !== 'hidden' &&
        type !== 'submit' &&
        /output|answer|solution/i.test(name)
      ) {
        outputFieldName = name;
        return false;
      }
      return undefined;
    });
  }
  if (!outputFieldName) return null;

  return { action, hiddenFields, outputFieldName };
}

export function parseSubmissionResult(
  $: cheerio.CheerioAPI
): SubmissionResult {
  // Rosalind shows result banners in alert classes after submission.
  const success = $('.alert-success, .alert.success').first().text().trim();
  if (success) return { correct: true, message: success };

  const error = $('.alert-error, .alert-danger, .alert.error').first().text().trim();
  if (error) return { correct: false, message: error };

  // Fallback heuristics.
  const body = $('body').text();
  if (/correct/i.test(body) && !/incorrect/i.test(body)) {
    return { correct: true, message: 'Correct.' };
  }
  if (/incorrect|wrong answer/i.test(body)) {
    return { correct: false, message: 'Incorrect.' };
  }
  return {
    correct: false,
    message: 'Submission completed but result could not be parsed.'
  };
}
