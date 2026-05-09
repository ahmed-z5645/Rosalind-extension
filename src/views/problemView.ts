import * as vscode from 'vscode';
import katex from 'katex';

const ROSALIND_ORIGIN = 'https://rosalind.info';

function renderMathInHtml(html: string): string {
  // Display math: \[...\]
  let out = html.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => {
    try {
      return katex.renderToString(inner.trim(), { displayMode: true, throwOnError: false });
    } catch {
      return `<span>\\[${inner}\\]</span>`;
    }
  });
  // Inline math: $...$  (not $$)
  out = out.replace(/(?<!\$)\$([^$\n]{1,200}?)\$(?!\$)/g, (_m, inner) => {
    try {
      return katex.renderToString(inner.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return `<code>$${inner}$</code>`;
    }
  });
  return out;
}

function absolutizeHtml(html: string): string {
  return html
    .replace(/href="(\/[^"]*)"/g, `href="${ROSALIND_ORIGIN}$1"`)
    .replace(/src="(\/[^"]*)"/g, `src="${ROSALIND_ORIGIN}$1"`);
}

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export class ProblemWebviewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'rosalind.problem';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    view: vscode.WebviewView,
    _ctx: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist', 'katex')]
    };
    this._showPlaceholder();
  }

  showProblem(title: string, problemHtml: string, bioHtml?: string): void {
    if (!this._view) return;
    this._view.show(true);
    this._view.webview.html = this._buildHtml(title, problemHtml, bioHtml);
  }

  private _showPlaceholder(): void {
    this._view!.webview.html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none';">
<style>
  body{padding:16px;color:var(--vscode-foreground);font-family:var(--vscode-font-family);opacity:.7;font-style:italic;}
</style></head>
<body><p>Open a problem to read it here.</p></body></html>`;
  }

  private _buildHtml(title: string, problemHtml: string, bioHtml?: string): string {
    const n = nonce();
    const webview = this._view!.webview;
    const katexCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'katex', 'katex.min.css')
    );
    const csp = webview.cspSource;

    const problemContent = renderMathInHtml(absolutizeHtml(problemHtml));
    const bioContent = bioHtml ? renderMathInHtml(absolutizeHtml(bioHtml)) : null;

    const tabs = bioContent
      ? `<div class="tabs">
          <button class="tab active" data-pane="problem">Problem</button>
          <button class="tab" data-pane="bio">Biological Context</button>
        </div>`
      : '';

    const bioPaneHtml = bioContent
      ? `<div id="bio" class="pane" hidden>
          <h1>${escapeHtml(title)} — Biological Context</h1>
          ${bioContent}
        </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${n}'; img-src ${csp} https: data:; font-src ${csp};">
  <link rel="stylesheet" href="${katexCssUri}">
  <style>
    *{box-sizing:border-box;}
    body{margin:0;padding:0;background:var(--vscode-sideBar-background);color:var(--vscode-sideBar-foreground,var(--vscode-foreground));font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);line-height:1.6;}
    .tabs{display:flex;gap:0;border-bottom:1px solid var(--vscode-panel-border);background:var(--vscode-sideBar-background);position:sticky;top:0;z-index:10;}
    .tab{flex:1;padding:7px 10px;border:none;border-bottom:2px solid transparent;background:none;color:var(--vscode-tab-inactiveForeground,var(--vscode-foreground));font-family:inherit;font-size:12px;cursor:pointer;text-align:center;}
    .tab:hover{background:var(--vscode-list-hoverBackground);}
    .tab.active{border-bottom-color:var(--vscode-focusBorder);color:var(--vscode-tab-activeForeground,var(--vscode-foreground));font-weight:600;}
    .pane{padding:12px 14px;}
    h1{font-size:1.15em;margin:0 0 .75em;}
    h2{font-size:1em;border-bottom:1px solid var(--vscode-panel-border);padding-bottom:3px;margin-top:1.4em;}
    pre,code{background:var(--vscode-textBlockQuote-background);border-radius:3px;font-family:var(--vscode-editor-font-family);}
    pre{padding:8px;overflow-x:auto;font-size:.85em;}
    code{padding:1px 4px;font-size:.9em;}
    a{color:var(--vscode-textLink-foreground);text-decoration:none;}
    a:hover{text-decoration:underline;}
    img{max-width:100%;}
    .katex-display{overflow-x:auto;padding:4px 0;}
    table{border-collapse:collapse;margin:.75em 0;}
    td,th{border:1px solid var(--vscode-panel-border);padding:4px 8px;}
  </style>
</head>
<body>
  ${tabs}
  <div id="problem" class="pane">
    <h1>${escapeHtml(title)}</h1>
    ${problemContent}
  </div>
  ${bioPaneHtml}
  <script nonce="${n}">
    document.querySelectorAll('.tab').forEach(tab=>{
      tab.addEventListener('click',()=>{
        const id=tab.dataset.pane;
        document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===tab));
        document.querySelectorAll('.pane').forEach(p=>{p.hidden=p.id!==id;});
      });
    });
  </script>
</body>
</html>`;
  }

  dispose(): void {}
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
