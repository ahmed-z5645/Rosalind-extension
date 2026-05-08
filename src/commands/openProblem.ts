import * as vscode from 'vscode';
import * as cheerio from 'cheerio';
import { RosalindClient } from '../services/rosalindClient';
import {
  extractBioContextHtml,
  extractProblemHtml,
  extractTitle
} from '../services/scraper';
import { convertHtmlToMarkdown } from '../services/htmlToMarkdown';
import { ProblemContentProvider } from '../providers/problemContentProvider';

const SLUG_RE = /^[a-z0-9]+$/;

export function registerOpenProblemCommand(
  client: RosalindClient,
  provider: ProblemContentProvider
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

    const problemMd = `# ${title}\n\n${convertHtmlToMarkdown(problemHtml)}`;
    const problemUri = provider.buildProblemUri(id);
    provider.setContent(problemUri, problemMd);
    await vscode.commands.executeCommand(
      'markdown.showPreview',
      problemUri,
      undefined,
      { sideBySide: false, locked: false }
    );

    if (bioHtml && bioHtml.trim()) {
      const bioMd = `# ${title} — Biological Context\n\n${convertHtmlToMarkdown(bioHtml)}`;
      const bioUri = provider.buildContextUri(id);
      provider.setContent(bioUri, bioMd);
      await vscode.commands.executeCommand(
        'markdown.showPreviewToSide',
        bioUri
      );
    }
  });
}
