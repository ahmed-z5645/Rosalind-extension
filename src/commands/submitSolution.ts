import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as cheerio from 'cheerio';
import { RosalindClient } from '../services/rosalindClient';
import {
  extractSubmissionForm,
  parseSubmissionResult
} from '../services/scraper';

const SLUG_RE = /^[a-z0-9]+$/;

async function gatherOutput(): Promise<string | undefined> {
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'Paste output text', detail: 'Type or paste the answer string' },
      { label: 'Pick output file', detail: 'Choose a .txt file from disk' }
    ],
    { placeHolder: 'How do you want to provide your solution?' }
  );
  if (!choice) return undefined;

  if (choice.label.startsWith('Paste')) {
    const editor = vscode.window.activeTextEditor;
    const initial = editor?.document.getText(editor.selection) ?? '';
    return await vscode.window.showInputBox({
      prompt: 'Solution output',
      value: initial,
      ignoreFocusOut: true
    });
  }

  const picks = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Submit',
    filters: { 'Text files': ['txt'], All: ['*'] }
  });
  if (!picks || picks.length === 0) return undefined;
  return await fs.readFile(picks[0].fsPath, 'utf8');
}

export function registerSubmitSolutionCommand(
  client: RosalindClient
): vscode.Disposable {
  return vscode.commands.registerCommand('rosalind.submitSolution', async () => {
    const slug = await vscode.window.showInputBox({
      prompt: 'Rosalind problem ID to submit against',
      ignoreFocusOut: true,
      validateInput: (v) =>
        SLUG_RE.test(v.trim())
          ? null
          : 'Use the lowercase URL slug (letters/digits only).'
    });
    if (!slug) return;
    const id = slug.trim();

    const output = await gatherOutput();
    if (output === undefined) return;

    try {
      const responseHtml = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Rosalind: submitting ${id}…`
        },
        async () => {
          const problemHtml = await client.getProblem(id);
          const $problem = cheerio.load(problemHtml);
          const form = extractSubmissionForm($problem, id);
          if (!form) {
            throw new Error(
              'Submission form not found. Are you logged in and is the slug correct?'
            );
          }
          return client.submit(id, form, output);
        }
      );

      const $resp = cheerio.load(responseHtml);
      const result = parseSubmissionResult($resp);
      if (result.correct) {
        void vscode.window.showInformationMessage(
          `Rosalind ✅ ${result.message}`
        );
      } else {
        void vscode.window.showWarningMessage(
          `Rosalind ❌ ${result.message}`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Rosalind: ${message}`);
    }
  });
}
