import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function initLogger(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Rosalind');
  }
  return channel;
}

export function log(...args: unknown[]): void {
  const c = channel ?? initLogger();
  const stamp = new Date().toISOString();
  const line = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a, null, 2)))
    .join(' ');
  c.appendLine(`[${stamp}] ${line}`);
}

export function showLog(): void {
  channel?.show(true);
}
