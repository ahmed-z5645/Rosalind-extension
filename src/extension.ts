import * as vscode from 'vscode';
import { RosalindClient } from './services/rosalindClient';
import { loadJar, saveJar } from './services/session';
import { initLogger } from './services/logger';
import {
  ProblemContentProvider,
  ROSALIND_SCHEME
} from './providers/problemContentProvider';
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

let clientRef: RosalindClient | undefined;
let secretsRef: vscode.SecretStorage | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  secretsRef = context.secrets;
  const channel = initLogger();
  context.subscriptions.push(channel);

  const jar = await loadJar(context.secrets);
  const client = new RosalindClient(jar);
  clientRef = client;

  const provider = new ProblemContentProvider();
  const actionsView = new ActionsTreeProvider();

  const refreshActions = async () => {
    const signedIn = await refreshSignedInContext(client);
    actionsView.setSignedIn(signedIn);
  };

  // Initial state — fire-and-forget so activation isn't blocked on a network call.
  void refreshActions();

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(ROSALIND_SCHEME, provider),
    provider,
    vscode.window.registerTreeDataProvider('rosalind.actions', actionsView),
    actionsView,
    registerSignInCommand(context, client, () => void refreshActions()),
    registerPasteSessionKeyCommand(context, client, () => void refreshActions()),
    registerSignOutCommand(context, client, () => void refreshActions()),
    registerCreateAccountCommand(),
    registerOpenProblemCommand(client, provider),
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

// Re-export so other modules can read the context key name.
export { SIGNED_IN_CONTEXT };
