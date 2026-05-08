import * as vscode from 'vscode';
import { RosalindClient } from '../services/rosalindClient';
import { startDatasetTimer } from '../services/timer';

const SLUG_RE = /^[a-z0-9]+$/;

export function registerStartTimerCommand(
  context: vscode.ExtensionContext,
  client: RosalindClient
): vscode.Disposable {
  return vscode.commands.registerCommand('rosalind.startTimer', async () => {
    if (!vscode.workspace.workspaceFolders?.length) {
      void vscode.window.showErrorMessage(
        'Rosalind: open a folder before starting the dataset timer.'
      );
      return;
    }

    const slug = await vscode.window.showInputBox({
      prompt: 'Rosalind problem ID for the dataset',
      ignoreFocusOut: true,
      validateInput: (v) =>
        SLUG_RE.test(v.trim())
          ? null
          : 'Use the lowercase URL slug (letters/digits only).'
    });
    if (!slug) return;
    const id = slug.trim();

    let dataset: string;
    try {
      dataset = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Rosalind: downloading dataset for ${id}…`
        },
        async () => client.getDataset(id)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Rosalind: ${message}`);
      return;
    }

    if (
      dataset.includes('id_form_login') ||
      /please log in/i.test(dataset)
    ) {
      void vscode.window.showErrorMessage(
        'Rosalind: log in first (Rosalind: Login).'
      );
      return;
    }

    try {
      const disposable = await startDatasetTimer(id, dataset);
      context.subscriptions.push(disposable);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Rosalind: ${message}`);
    }
  });
}
