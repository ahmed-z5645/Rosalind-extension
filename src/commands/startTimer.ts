import * as vscode from 'vscode';
import { RosalindClient } from '../services/rosalindClient';
import { pickProblem } from '../services/problemPicker';
import { startDatasetTimer } from '../services/timer';
import { ProblemWebviewProvider } from '../views/problemView';

export function registerStartTimerCommand(
  context: vscode.ExtensionContext,
  client: RosalindClient,
  problemView: ProblemWebviewProvider
): vscode.Disposable {
  return vscode.commands.registerCommand('rosalind.startTimer', async () => {
    if (!vscode.workspace.workspaceFolders?.length) {
      void vscode.window.showErrorMessage(
        'Rosalind: open a folder before starting the dataset timer.'
      );
      return;
    }

    const slug = problemView.currentSlug ?? await pickProblem(client);
    if (!slug) return;

    let dataset: string;
    try {
      dataset = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Rosalind: downloading dataset for ${slug}…`
        },
        async () => client.getDataset(slug)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Rosalind: ${message}`);
      return;
    }

    if (dataset.includes('id_form_login') || /please log in/i.test(dataset)) {
      void vscode.window.showErrorMessage('Rosalind: log in first.');
      return;
    }

    try {
      const disposable = await startDatasetTimer(slug, dataset);
      context.subscriptions.push(disposable);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Rosalind: ${message}`);
    }
  });
}
