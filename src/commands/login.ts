import * as vscode from 'vscode';
import { RosalindClient } from '../services/rosalindClient';
import { saveJar, setUsername } from '../services/session';

export function registerLoginCommand(
  context: vscode.ExtensionContext,
  client: RosalindClient
): vscode.Disposable {
  return vscode.commands.registerCommand('rosalind.login', async () => {
    const username = await vscode.window.showInputBox({
      prompt: 'Rosalind username',
      ignoreFocusOut: true,
      validateInput: (v) => (v.trim().length > 0 ? null : 'Username required.')
    });
    if (!username) return;

    const password = await vscode.window.showInputBox({
      prompt: 'Rosalind password',
      password: true,
      ignoreFocusOut: true,
      validateInput: (v) => (v.length > 0 ? null : 'Password required.')
    });
    if (!password) return;

    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Rosalind: signing in…' },
        async () => {
          await client.login(username.trim(), password);
        }
      );
      await saveJar(context.secrets, client.jar);
      await setUsername(context.globalState, username.trim());
      void vscode.window.showInformationMessage(
        `Rosalind: logged in as ${username.trim()}.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      void vscode.window.showErrorMessage(`Rosalind login failed: ${message}`);
    }
  });
}
