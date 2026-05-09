import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import { RosalindClient } from '../services/rosalindClient';
import {
  extractBioContextHtml,
  extractProblemHtml,
  extractTitle
} from '../services/scraper';
import { pickProblem } from '../services/problemPicker';
import { ProblemWebviewProvider } from '../views/problemView';

export function registerOpenProblemCommand(
  client: RosalindClient,
  problemView: ProblemWebviewProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('rosalind.openProblem', async () => {
    const slug = await pickProblem(client, problemView.currentSlug);
    if (!slug) return;

    let html: string;
    try {
      html = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Rosalind: fetching ${slug}…`
        },
        async () => client.getProblem(slug)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Rosalind: ${message}`);
      return;
    }

    const $ = cheerio.load(html);
    const title = extractTitle($) || slug;
    const problemHtml = extractProblemHtml($);
    const bioHtml = extractBioContextHtml($);

    if (!problemHtml) {
      void vscode.window.showErrorMessage(
        `Rosalind: could not parse problem "${slug}". Are you logged in?`
      );
      return;
    }

    problemView.showProblem(slug, title, problemHtml, bioHtml ?? undefined);
  });
}
