import * as vscode from 'vscode';
import { RosalindClient } from '../services/rosalindClient';
import { findRosalindSession } from '../services/browserCookies';
import { saveJar, setUsername } from '../services/session';

export const SIGNED_IN_CONTEXT = 'rosalind.signedIn';

async function attemptCapture(
  client: RosalindClient
): Promise<{ source: string } | null> {
  const session = await findRosalindSession();
  if (!session) return null;
  await client.setSessionCookie(session.sessionid);
  const ok = await client.isLoggedIn();
  if (!ok) {
    return null;
  }
  return { source: session.source };
}

export function registerSignInCommand(
  context: vscode.ExtensionContext,
  client: RosalindClient,
  onChange: () => void
): vscode.Disposable {
  const disposable = vscode.commands.registerCommand(
    'rosalind.signIn',
    async () => {
      // First, see if the user is already signed in to Rosalind in some browser.
      try {
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Rosalind: looking for a browser session…'
          },
          async () => attemptCapture(client)
        );
        if (result) {
          await saveJar(context.secrets, client.jar);
          await vscode.commands.executeCommand(
            'setContext',
            SIGNED_IN_CONTEXT,
            true
          );
          onChange();
          void vscode.window.showInformationMessage(
            `Rosalind: signed in via ${result.source}.`
          );
          return;
        }
      } catch (err) {
        // Fall through to browser-prompt flow with the error visible.
        const message = err instanceof Error ? err.message : String(err);
        const proceed = await vscode.window.showWarningMessage(
          `Rosalind: ${message}`,
          {
            modal: true,
            detail:
              'Open Rosalind in your browser and sign in, then try again — or use the Safari fallback to paste your session key.'
          },
          'Open Rosalind',
          'Paste Session Key'
        );
        if (proceed === 'Paste Session Key') {
          await vscode.commands.executeCommand('rosalind.pasteSessionKey');
          return;
        }
        if (proceed !== 'Open Rosalind') return;
      }

      // Open browser to login URL and wait for the user to confirm.
      await vscode.env.openExternal(
        vscode.Uri.parse('https://rosalind.info/accounts/login/')
      );
      const ready = await vscode.window.showInformationMessage(
        'Sign in to Rosalind in your browser, then click "I\'m signed in" to capture the session.',
        { modal: true },
        "I'm signed in"
      );
      if (!ready) return;

      try {
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Rosalind: capturing browser session…'
          },
          async () => attemptCapture(client)
        );
        if (!result) {
          const choice = await vscode.window.showErrorMessage(
            'Rosalind: signed-in cookie not found. Make sure you completed the sign-in in the browser tab that opened.',
            'Paste Session Key'
          );
          if (choice === 'Paste Session Key') {
            await vscode.commands.executeCommand('rosalind.pasteSessionKey');
          }
          return;
        }

        await saveJar(context.secrets, client.jar);
        await setUsername(context.globalState, '');
        await vscode.commands.executeCommand(
          'setContext',
          SIGNED_IN_CONTEXT,
          true
        );
        onChange();
        void vscode.window.showInformationMessage(
          `Rosalind: signed in via ${result.source}. The session persists across VS Code restarts.`
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        void vscode.window.showErrorMessage(`Rosalind: ${message}`);
      }
    }
  );

  return disposable;
}

export function registerSignOutCommand(
  context: vscode.ExtensionContext,
  client: RosalindClient,
  onChange: () => void
): vscode.Disposable {
  return vscode.commands.registerCommand('rosalind.signOut', async () => {
    const choice = await vscode.window.showWarningMessage(
      'Sign out of Rosalind in this extension? (Your browser session is unaffected.)',
      { modal: true },
      'Sign Out'
    );
    if (choice !== 'Sign Out') return;
    await context.secrets.delete('rosalind.cookieJar');
    // Replace the client's jar contents with a fresh one by clearing rosalind.info.
    const cookies = await client.jar.getCookies('https://rosalind.info');
    for (const c of cookies) {
      try {
        await client.jar.setCookie(
          `${c.key}=; Path=/; Domain=rosalind.info; Max-Age=0`,
          'https://rosalind.info'
        );
      } catch {
        /* best effort */
      }
    }
    await vscode.commands.executeCommand(
      'setContext',
      SIGNED_IN_CONTEXT,
      false
    );
    await setUsername(context.globalState, '');
    onChange();
    void vscode.window.showInformationMessage('Rosalind: signed out.');
  });
}

export async function refreshSignedInContext(
  client: RosalindClient
): Promise<boolean> {
  try {
    const ok = await client.isLoggedIn();
    await vscode.commands.executeCommand(
      'setContext',
      SIGNED_IN_CONTEXT,
      ok
    );
    return ok;
  } catch {
    await vscode.commands.executeCommand(
      'setContext',
      SIGNED_IN_CONTEXT,
      false
    );
    return false;
  }
}
