import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as cheerio from 'cheerio';
import { RosalindClient } from '../services/rosalindClient';
import {
  extractSubmissionForm,
  parseSubmissionResult
} from '../services/scraper';
import { pickProblem } from '../services/problemPicker';
import { ProblemWebviewProvider } from '../views/problemView';

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
  client: RosalindClient,
  problemView: ProblemWebviewProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('rosalind.submitSolution', async () => {
    const slug = problemView.currentSlug ?? await pickProblem(client);
    if (!slug) return;

    const output = await gatherOutput();
    if (output === undefined) return;

    try {
      const responseHtml = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Rosalind: submitting ${slug}…`
        },
        async () => {
          const problemHtml = await client.getProblem(slug);
          const $problem = cheerio.load(problemHtml);
          const form = extractSubmissionForm($problem, slug);
          if (!form) {
            throw new Error(
              'Submission form not found. Are you logged in and is the problem correct?'
            );
          }
          return client.submit(slug, form, output);
        }
      );

      const $resp = cheerio.load(responseHtml);
      const result = parseSubmissionResult($resp);
      if (result.correct) {
        void vscode.window.showInformationMessage(`Rosalind ✅ ${result.message}`);
      } else {
        void vscode.window.showWarningMessage(`Rosalind ❌ ${result.message}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Rosalind: ${message}`);
    }
  });
}
