import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import { RosalindClient } from '../services/rosalindClient';
import {
  extractBioContextHtml,
  extractProblemHtml,
  extractTitle
} from '../services/scraper';
import { ProblemWebviewProvider } from '../views/problemView';

const SLUG_RE = /^[a-z0-9]+$/;

export function registerOpenProblemCommand(
  client: RosalindClient,
  problemView: ProblemWebviewProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('rosalind.openProblem', async () => {
    const slug = await vscode.window.showInputBox({
      prompt: 'Rosalind problem ID (e.g. dna, rna, revc)',
      ignoreFocusOut: true,
      validateInput: (v) =>
        SLUG_RE.test(v.trim())
          ? null
          : 'Use the lowercase URL slug (letters/digits only).'
    });
    if (!slug) return;
    const id = slug.trim();

    let html: string;
    try {
      html = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Rosalind: fetching ${id}…`
        },
        async () => client.getProblem(id)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Rosalind: ${message}`);
      return;
    }

    const $ = cheerio.load(html);
    const title = extractTitle($) || `Rosalind: ${id}`;
    const problemHtml = extractProblemHtml($);
    const bioHtml = extractBioContextHtml($);

    if (!problemHtml) {
      void vscode.window.showErrorMessage(
        `Rosalind: could not parse problem "${id}". Are you logged in?`
      );
      return;
    }

    problemView.showProblem(title, problemHtml, bioHtml ?? undefined);
  });
}
