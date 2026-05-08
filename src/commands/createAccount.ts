import * as vscode from 'vscode';

export function registerCreateAccountCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('rosalind.createAccount', async () => {
    await vscode.env.openExternal(
      vscode.Uri.parse('https://rosalind.info/accounts/register/')
    );
  });
}
