import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import { RosalindClient } from './rosalindClient';
import { extractProblemList } from './scraper';

/**
 * Shows a QuickPick populated with Rosalind problems fetched from the site.
 * Returns the chosen slug, or undefined if cancelled.
 * If `currentSlug` is provided it appears pre-selected at the top.
 */
export async function pickProblem(
  client: RosalindClient,
  currentSlug?: string
): Promise<string | undefined> {
  const qp = vscode.window.createQuickPick();
  qp.placeholder = 'Loading problems…';
  qp.busy = true;
  qp.matchOnDescription = true;
  qp.show();

  try {
    const html = await client.getProblemList();
    const $ = cheerio.load(html);
    const problems = extractProblemList($);

    if (problems.length === 0) {
      qp.dispose();
      void vscode.window.showErrorMessage(
        'Rosalind: could not load problem list. Are you signed in?'
      );
      return undefined;
    }

    const items = problems.map((p) => ({
      label: p.title,
      description: p.slug,
      // put the current problem first
      picked: p.slug === currentSlug
    }));

    if (currentSlug) {
      items.sort((a, b) =>
        a.description === currentSlug ? -1 : b.description === currentSlug ? 1 : 0
      );
    }

    qp.items = items;
    qp.busy = false;
    qp.placeholder = 'Select a problem';

    if (currentSlug) {
      const current = items.find((i) => i.description === currentSlug);
      if (current) qp.activeItems = [current];
    }

    return await new Promise<string | undefined>((resolve) => {
      let picked: string | undefined;
      qp.onDidAccept(() => {
        picked = qp.selectedItems[0]?.description;
        qp.hide(); // triggers onDidHide, which resolves
      });
      qp.onDidHide(() => {
        qp.dispose();
        resolve(picked); // undefined if cancelled, slug if accepted
      });
    });
  } catch (err) {
    qp.dispose();
    const msg = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Rosalind: ${msg}`);
    return undefined;
  }
}
