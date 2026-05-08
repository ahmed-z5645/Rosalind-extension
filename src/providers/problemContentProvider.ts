import * as vscode from 'vscode';

export const ROSALIND_SCHEME = 'rosalind';

export class ProblemContentProvider
  implements vscode.TextDocumentContentProvider
{
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private readonly cache = new Map<string, string>();

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.cache.get(uri.toString()) ?? '';
  }

  setContent(uri: vscode.Uri, content: string): void {
    this.cache.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  buildProblemUri(slug: string): vscode.Uri {
    return vscode.Uri.parse(`${ROSALIND_SCHEME}:/${slug}/problem.md`);
  }

  buildContextUri(slug: string): vscode.Uri {
    return vscode.Uri.parse(`${ROSALIND_SCHEME}:/${slug}/context.md`);
  }

  dispose(): void {
    this._onDidChange.dispose();
    this.cache.clear();
  }
}
