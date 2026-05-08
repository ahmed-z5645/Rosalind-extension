import * as cheerio from 'cheerio';
import type { SubmissionForm, SubmissionResult } from './rosalindClient';

const BIO_HEADER_ID = 'a-rapid-introduction-to-molecular-biology';
const PROBLEM_HEADER_ID = 'problem';
const SAMPLE_DATASET_ID = 'sample-dataset';

function htmlBetween(
  $: cheerio.CheerioAPI,
  fromId: string,
  toId: string | null
): string | null {
  const start = $(`#${fromId}`).first();
  if (start.length === 0) return null;

  const collected: string[] = [];
  let node = start.next();
  while (node.length > 0) {
    if (toId && node.attr('id') === toId) break;
    if (node.is('h2') && toId === null) {
      // No explicit stop; bail at next h2 (defensive).
      break;
    }
    collected.push($.html(node) || '');
    node = node.next();
  }
  return collected.join('\n');
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
  return htmlBetween($, BIO_HEADER_ID, PROBLEM_HEADER_ID);
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
