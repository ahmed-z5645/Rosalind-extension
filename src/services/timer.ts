import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

const FIVE_MINUTES_SEC = 5 * 60;

let active: ActiveTimer | undefined;

interface ActiveTimer {
  filePath: string;
  statusBarItem: vscode.StatusBarItem;
  intervalHandle: NodeJS.Timeout;
  dispose: () => void;
}

function format(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    /* already gone */
  }
}

export async function startDatasetTimer(
  slug: string,
  datasetText: string
): Promise<vscode.Disposable> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    throw new Error(
      'Open a folder in VS Code before starting the dataset timer.'
    );
  }

  if (active) {
    active.dispose();
    active = undefined;
  }

  const root = folders[0].uri.fsPath;
  const dir = path.join(root, '.rosalind');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${slug}-${Date.now()}.txt`);
  await fs.writeFile(filePath, datasetText, 'utf8');

  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc, { preview: false });

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    1000
  );
  statusBarItem.show();

  let remaining = FIVE_MINUTES_SEC;
  statusBarItem.text = `$(clock) Rosalind: ${format(remaining)}`;

  const intervalHandle = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      void expire();
      return;
    }
    statusBarItem.text = `$(clock) Rosalind: ${format(remaining)}`;
  }, 1000);

  const dispose = () => {
    clearInterval(intervalHandle);
    statusBarItem.dispose();
  };

  const expire = async () => {
    dispose();
    await safeUnlink(filePath);
    active = undefined;
    void vscode.window.showInformationMessage(
      `Rosalind: dataset for "${slug}" expired and was deleted.`
    );
  };

  active = { filePath, statusBarItem, intervalHandle, dispose };

  return new vscode.Disposable(() => {
    if (active && active.filePath === filePath) {
      dispose();
      void safeUnlink(filePath);
      active = undefined;
    }
  });
}
