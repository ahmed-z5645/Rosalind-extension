import * as vscode from 'vscode';
import { RosalindClient } from './services/rosalindClient';
import { loadJar, saveJar } from './services/session';
import {
  ProblemContentProvider,
  ROSALIND_SCHEME
} from './providers/problemContentProvider';
import { registerLoginCommand } from './commands/login';
import { registerCreateAccountCommand } from './commands/createAccount';
import { registerOpenProblemCommand } from './commands/openProblem';
import { registerStartTimerCommand } from './commands/startTimer';
import { registerSubmitSolutionCommand } from './commands/submitSolution';

let clientRef: RosalindClient | undefined;
let secretsRef: vscode.SecretStorage | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  secretsRef = context.secrets;

  const jar = await loadJar(context.secrets);
  const client = new RosalindClient(jar);
  clientRef = client;

  const provider = new ProblemContentProvider();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(ROSALIND_SCHEME, provider),
    provider,
    registerLoginCommand(context, client),
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
