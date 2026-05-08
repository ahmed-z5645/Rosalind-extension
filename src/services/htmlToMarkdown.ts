import TurndownService from 'turndown';

const ROSALIND_ORIGIN = 'https://rosalind.info';

const MATH_PLACEHOLDER_OPEN = 'MATH_OPEN';
const MATH_PLACEHOLDER_CLOSE = 'MATH_CLOSE';
const MATH_DOLLAR = 'DOLLAR';

function preprocessMath(html: string): string {
  // Convert display math \[ ... \] to placeholders so turndown won't mangle.
  let out = html.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => {
    return `\n\n${MATH_PLACEHOLDER_OPEN}${inner}${MATH_PLACEHOLDER_CLOSE}\n\n`;
  });
  // Also convert inline $...$ to a placeholder so turndown's escaper leaves them.
  // Rosalind uses single $...$ on a single line; avoid greedy multi-line matches.
  out = out.replace(/(?<!\$)\$([^\n$]+?)\$(?!\$)/g, (_m, inner) => {
    return `${MATH_DOLLAR}${inner}${MATH_DOLLAR}`;
  });
  return out;
}

function postprocessMath(md: string): string {
  let out = md.replace(
    new RegExp(`${MATH_PLACEHOLDER_OPEN}([\\s\\S]*?)${MATH_PLACEHOLDER_CLOSE}`, 'g'),
    (_m, inner) => `\n\n$$\n${inner.trim()}\n$$\n\n`
  );
  out = out.replace(
    new RegExp(`${MATH_DOLLAR}([\\s\\S]*?)${MATH_DOLLAR}`, 'g'),
    (_m, inner) => `$${inner}$`
  );
  return out;
}

function absolutize(url: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return ROSALIND_ORIGIN + url;
  return url;
}

interface AttrNode {
  nodeName: string;
  getAttribute(name: string): string | null;
}

function attr(node: unknown, name: string): string {
  return (node as AttrNode).getAttribute(name) || '';
}

function buildTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '_'
  });

  // Strip MathJax/script/style noise.
  td.remove(['script', 'style']);

  // Glossary terms — keep as plain links so the user can click through.
  td.addRule('glossary-term', {
    filter: (node) =>
      node.nodeName === 'A' && attr(node, 'class').includes('term'),
    replacement: (content, node) =>
      `[${content}](${absolutize(attr(node, 'href'))})`
  });

  // Lightbox figure links — turn into image embeds.
  td.addRule('figure-lightbox', {
    filter: (node) =>
      node.nodeName === 'A' && attr(node, 'rel').includes('lightbox'),
    replacement: (content, node) => {
      const alt = content.trim() || 'Figure';
      return `\n\n![${alt}](${absolutize(attr(node, 'href'))})\n\n`;
    }
  });

  // Generic link absolutizer for site-relative hrefs.
  td.addRule('absolutize-links', {
    filter: (node) => {
      if (node.nodeName !== 'A') return false;
      const cls = attr(node, 'class');
      const rel = attr(node, 'rel');
      if (cls.includes('term') || rel.includes('lightbox')) return false;
      return attr(node, 'href').startsWith('/');
    },
    replacement: (content, node) =>
      `[${content}](${absolutize(attr(node, 'href'))})`
  });

  // Absolutize image sources too.
  td.addRule('absolutize-images', {
    filter: 'img',
    replacement: (_content, node) => {
      const src = attr(node, 'src');
      const alt = attr(node, 'alt');
      if (!src) return '';
      return `![${alt}](${absolutize(src)})`;
    }
  });

  // Don't escape backslashes inside math — we already protected math with placeholders,
  // but other backslashes (rare) should pass through too.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (td as any).escape = (s: string) => s;

  return td;
}

export function convertHtmlToMarkdown(html: string): string {
  if (!html.trim()) return '';
  const protectedHtml = preprocessMath(html);
  const td = buildTurndown();
  const md = td.turndown(protectedHtml);
  return postprocessMath(md).trim() + '\n';
}
