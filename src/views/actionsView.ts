import * as vscode from 'vscode';

interface ActionDef {
  id: string;
  label: string;
  description?: string;
  command: string;
  icon: string; // codicon name
  whenSignedIn?: boolean; // only show when signed in
  whenSignedOut?: boolean; // only show when signed out
}

const ACTIONS: ActionDef[] = [
  {
    id: 'signIn',
    label: 'Sign In with Browser',
    description: 'Opens Rosalind in your default browser',
    command: 'rosalind.signIn',
    icon: 'sign-in',
    whenSignedOut: true
  },
  {
    id: 'signedIn',
    label: 'Signed In',
    description: 'Click to sign out',
    command: 'rosalind.signOut',
    icon: 'check',
    whenSignedIn: true
  },
  {
    id: 'openProblem',
    label: 'Open Problem',
    description: 'Read the task and biological context',
    command: 'rosalind.openProblem',
    icon: 'book'
  },
  {
    id: 'startTimer',
    label: 'Start Dataset Timer',
    description: '5-minute solve countdown',
    command: 'rosalind.startTimer',
    icon: 'clock'
  },
  {
    id: 'submitSolution',
    label: 'Submit Solution',
    description: 'Send your answer to Rosalind',
    command: 'rosalind.submitSolution',
    icon: 'cloud-upload'
  },
  {
    id: 'createAccount',
    label: 'Create Account',
    description: 'Open the Rosalind sign-up page',
    command: 'rosalind.createAccount',
    icon: 'person-add',
    whenSignedOut: true
  }
];

export class ActionsTreeProvider
  implements vscode.TreeDataProvider<ActionDef>
{
  private readonly _onDidChange = new vscode.EventEmitter<
    ActionDef | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChange.event;

  private signedIn = false;

  setSignedIn(value: boolean): void {
    this.signedIn = value;
    this._onDidChange.fire(undefined);
  }

  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(element: ActionDef): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = element.description;
    item.iconPath = new vscode.ThemeIcon(element.icon);
    item.command = {
      command: element.command,
      title: element.label
    };
    return item;
  }

  getChildren(): ActionDef[] {
    return ACTIONS.filter((a) => {
      if (a.whenSignedIn && !this.signedIn) return false;
      if (a.whenSignedOut && this.signedIn) return false;
      return true;
    });
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}
