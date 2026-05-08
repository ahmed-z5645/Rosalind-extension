import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs: (config?: { wasmBinary?: ArrayBuffer | Uint8Array }) => Promise<SqlJsStatic> = require('sql.js');
// esbuild bundles the wasm file into the JS as a binary buffer.
import wasmBinary from '../../node_modules/sql.js/dist/sql-wasm.wasm';

interface SqlJsStatement {
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): void;
}
interface SqlJsDatabase {
  prepare(sql: string): SqlJsStatement;
  close(): void;
}
interface SqlJsStatic {
  Database: new (data?: Uint8Array) => SqlJsDatabase;
}

interface BrowserCandidate {
  name: string;
  cookiePath: string;
  keychainService: string;
}

const HOME = os.homedir();
const HOST_FILTER = 'rosalind.info';

function macOSCandidates(): BrowserCandidate[] {
  const support = path.join(HOME, 'Library', 'Application Support');
  return [
    {
      name: 'Google Chrome',
      cookiePath: path.join(support, 'Google/Chrome/Default/Cookies'),
      keychainService: 'Chrome Safe Storage'
    },
    {
      name: 'Brave',
      cookiePath: path.join(
        support,
        'BraveSoftware/Brave-Browser/Default/Cookies'
      ),
      keychainService: 'Brave Safe Storage'
    },
    {
      name: 'Microsoft Edge',
      cookiePath: path.join(support, 'Microsoft Edge/Default/Cookies'),
      keychainService: 'Microsoft Edge Safe Storage'
    },
    {
      name: 'Arc',
      cookiePath: path.join(support, 'Arc/User Data/Default/Cookies'),
      keychainService: 'Arc Safe Storage'
    },
    {
      name: 'Vivaldi',
      cookiePath: path.join(support, 'Vivaldi/Default/Cookies'),
      keychainService: 'Vivaldi Safe Storage'
    },
    {
      name: 'Opera',
      cookiePath: path.join(support, 'com.operasoftware.Opera/Cookies'),
      keychainService: 'Opera Safe Storage'
    },
    {
      name: 'Chromium',
      cookiePath: path.join(support, 'Chromium/Default/Cookies'),
      keychainService: 'Chromium Safe Storage'
    }
  ];
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function sortByMTime(
  candidates: BrowserCandidate[]
): Promise<BrowserCandidate[]> {
  const withStat: Array<{ c: BrowserCandidate; mtime: number }> = [];
  for (const c of candidates) {
    if (!(await fileExists(c.cookiePath))) continue;
    try {
      const st = await fs.stat(c.cookiePath);
      withStat.push({ c, mtime: st.mtimeMs });
    } catch {
      /* skip */
    }
  }
  withStat.sort((a, b) => b.mtime - a.mtime);
  return withStat.map((w) => w.c);
}

interface ParsedCookie {
  name: string;
  value: string;
  host: string;
}

function readKeychainPassword(service: string): string {
  const out = execFileSync(
    'security',
    ['find-generic-password', '-s', service, '-wa', service.split(' ')[0]],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return out.trim();
}

function deriveKey(password: string): Buffer {
  // macOS Chrome AES key: PBKDF2-HMAC-SHA1, salt "saltysalt", 1003 iters, 16 bytes.
  return crypto.pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
}

function decryptValue(encrypted: Buffer, key: Buffer): string {
  if (encrypted.length === 0) return '';
  const prefix = encrypted.subarray(0, 3).toString('utf8');
  const cipher =
    prefix === 'v10' || prefix === 'v11' ? encrypted.subarray(3) : encrypted;
  const iv = Buffer.alloc(16, ' ');
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(true);
  const decrypted = Buffer.concat([decipher.update(cipher), decipher.final()]);
  // Modern Chrome (v118+) prepends a 32-byte SHA256 of the host. Strip if present.
  if (
    decrypted.length > 32 &&
    /^[A-Za-z0-9._-]/.test(decrypted.toString('utf8', 32, 33))
  ) {
    return decrypted.toString('utf8', 32);
  }
  return decrypted.toString('utf8');
}

let sqlPromise: Promise<SqlJsStatic> | null = null;
function loadSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ wasmBinary: wasmBinary as unknown as ArrayBuffer });
  }
  return sqlPromise;
}

async function readChromiumCookies(
  candidate: BrowserCandidate
): Promise<ParsedCookie[]> {
  const SQL = await loadSql();
  const tmp = path.join(os.tmpdir(), `rosalind-cookies-${Date.now()}.sqlite`);
  await fs.copyFile(candidate.cookiePath, tmp);
  const rawRows: Array<{
    name: string;
    value: string;
    encrypted_value: Uint8Array;
    host_key: string;
  }> = [];
  try {
    const data = await fs.readFile(tmp);
    const db = new SQL.Database(data);
    const stmt = db.prepare(
      `SELECT name, value, encrypted_value, host_key
       FROM cookies
       WHERE host_key LIKE '%${HOST_FILTER}'`
    );
    while (stmt.step()) {
      rawRows.push(stmt.getAsObject() as unknown as (typeof rawRows)[number]);
    }
    stmt.free();
    db.close();
  } finally {
    fs.unlink(tmp).catch(() => {});
  }
  if (rawRows.length === 0) return [];

  const password = readKeychainPassword(candidate.keychainService);
  const key = deriveKey(password);

  return rawRows.map((r) => ({
    name: r.name,
    value:
      r.encrypted_value && r.encrypted_value.length > 0
        ? decryptValue(Buffer.from(r.encrypted_value), key)
        : r.value || '',
    host: r.host_key
  }));
}

export interface ExtractedSession {
  sessionid: string;
  csrftoken?: string;
  source: string;
}

export async function findRosalindSession(): Promise<ExtractedSession | null> {
  if (process.platform !== 'darwin') {
    throw new Error(
      'Automated browser sign-in currently supports macOS only. Linux and Windows support is planned.'
    );
  }

  const candidates = await sortByMTime(macOSCandidates());
  if (candidates.length === 0) {
    throw new Error(
      'No supported browser cookie store was found. Sign in with Chrome, Brave, Edge, Arc, Vivaldi, Opera, or Chromium — or use "Paste Session Key" (Safari fallback).'
    );
  }

  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      const cookies = await readChromiumCookies(candidate);
      if (cookies.length === 0) continue;

      let sessionid: string | undefined;
      let csrftoken: string | undefined;
      for (const c of cookies) {
        if (c.name === 'sessionid' && c.value) sessionid = c.value;
        if (c.name === 'csrftoken' && c.value) csrftoken = c.value;
      }
      if (sessionid) {
        return { sessionid, csrftoken, source: candidate.name };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${candidate.name}: ${msg}`);
      continue;
    }
  }

  if (errors.length > 0) {
    throw new Error(
      'Could not read a Rosalind session from any browser. Details:\n' +
        errors.join('\n')
    );
  }

  return null;
}
