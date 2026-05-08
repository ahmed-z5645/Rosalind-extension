import * as vscode from 'vscode';
import { RosalindClient } from '../services/rosalindClient';
import { saveJar, setUsername } from '../services/session';
import { showLog } from '../services/logger';
import { SIGNED_IN_CONTEXT } from './signIn';

const SAFARI_INSTRUCTIONS =
  'Safari fallback. Get your session key:\n' +
  '\n' +
  '1. Open Safari and sign in to https://rosalind.info/.\n' +
  '2. Safari → Settings → Advanced → check "Show features for web developers".\n' +
  '3. Develop → Show Web Inspector → Storage → Cookies → rosalind.info.\n' +
  '4. Copy the value of the row named `sessionid`, then paste it here.';

export function registerPasteSessionKeyCommand(
  context: vscode.ExtensionContext,
  client: RosalindClient,
  onChange: () => void
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'rosalind.pasteSessionKey',
    async () => {
      const proceed = await vscode.window.showInformationMessage(
        'Sign in by pasting your Rosalind sessionid.',
        { modal: true, detail: SAFARI_INSTRUCTIONS },
        'Open Rosalind',
        'I have my sessionid'
      );
      if (!proceed) return;
      if (proceed === 'Open Rosalind') {
        await vscode.env.openExternal(
          vscode.Uri.parse('https://rosalind.info/accounts/login/')
        );
      }

      const sessionid = await vscode.window.showInputBox({
        prompt: 'Paste your Rosalind sessionid cookie value',
        placeHolder: 'e.g. 19478ea7324c983d2eccc314a62c774c',
        password: true,
        ignoreFocusOut: true,
        validateInput: (v) => {
          const t = v.trim();
          if (t.length === 0) return 'Required.';
          if (!/^[A-Za-z0-9]+$/.test(t))
            return 'Cookie value should be alphanumeric — paste only the value, not the whole cookie line.';
          return null;
        }
      });
      if (!sessionid) return;

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Rosalind: verifying session…'
          },
          async () => {
            await client.setSessionCookie(sessionid);
            const ok = await client.isLoggedIn();
            if (!ok) {
              throw new Error(
                'Rosalind did not accept that session. Make sure you copied the value of the sessionid cookie (not csrftoken) and that you are still logged in.'
              );
            }
          }
        );

        await saveJar(context.secrets, client.jar);
        await setUsername(context.globalState, '');
        await vscode.commands.executeCommand(
          'setContext',
          SIGNED_IN_CONTEXT,
          true
        );
        onChange();
        void vscode.window.showInformationMessage(
          'Rosalind: signed in via session key. The session persists across VS Code restarts.'
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const choice = await vscode.window.showErrorMessage(
          `Rosalind: ${message}`,
          'Show Log'
        );
        if (choice === 'Show Log') showLog();
      }
    }
  );
}
