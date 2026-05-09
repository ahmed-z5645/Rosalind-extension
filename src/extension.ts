import * as vscode from 'vscode';
import { RosalindClient } from './services/rosalindClient';
import { loadJar, saveJar } from './services/session';
import { initLogger } from './services/logger';
import {
  registerSignInCommand,
  registerSignOutCommand,
  refreshSignedInContext,
  SIGNED_IN_CONTEXT
} from './commands/signIn';
import { registerPasteSessionKeyCommand } from './commands/pasteSessionKey';
import { registerCreateAccountCommand } from './commands/createAccount';
import { registerOpenProblemCommand } from './commands/openProblem';
import { registerStartTimerCommand } from './commands/startTimer';
import { registerSubmitSolutionCommand } from './commands/submitSolution';
import { ActionsTreeProvider } from './views/actionsView';
import { ProblemWebviewProvider } from './views/problemView';

let clientRef: RosalindClient | undefined;
let secretsRef: vscode.SecretStorage | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  secretsRef = context.secrets;
  const channel = initLogger();
  context.subscriptions.push(channel);

  const jar = await loadJar(context.secrets);
  const client = new RosalindClient(jar);
  clientRef = client;

  const actionsView = new ActionsTreeProvider();
  const problemView = new ProblemWebviewProvider(context.extensionUri);

  const refreshActions = async () => {
    const signedIn = await refreshSignedInContext(client);
    actionsView.setSignedIn(signedIn);
  };

  void refreshActions();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('rosalind.actions', actionsView),
    vscode.window.registerWebviewViewProvider(ProblemWebviewProvider.viewId, problemView),
    actionsView,
    registerSignInCommand(context, client, () => void refreshActions()),
    registerPasteSessionKeyCommand(context, client, () => void refreshActions()),
    registerSignOutCommand(context, client, () => void refreshActions()),
    registerCreateAccountCommand(),
    registerOpenProblemCommand(client, problemView),
    registerStartTimerCommand(context, client),
    registerSubmitSolutionCommand(client)
  );
}

export async function deactivate(): Promise<void> {
  if (clientRef && secretsRef) {
    try {
      await saveJar(secretsRef, clientRef.jar);
    } catch {
      /* best effort */
    }
  }
}

export { SIGNED_IN_CONTEXT };
