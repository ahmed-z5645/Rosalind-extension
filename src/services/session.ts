import * as vscode from 'vscode';
import { CookieJar } from 'tough-cookie';

const JAR_KEY = 'rosalind.cookieJar';
const USERNAME_KEY = 'rosalind.username';

export async function loadJar(secrets: vscode.SecretStorage): Promise<CookieJar> {
  const raw = await secrets.get(JAR_KEY);
  if (!raw) {
    return new CookieJar();
  }
  try {
    const parsed = JSON.parse(raw);
    return await CookieJar.deserialize(parsed);
  } catch {
    return new CookieJar();
  }
}

export async function saveJar(
  secrets: vscode.SecretStorage,
  jar: CookieJar
): Promise<void> {
  const serialized = await jar.serialize();
  await secrets.store(JAR_KEY, JSON.stringify(serialized));
}

export async function clearSession(secrets: vscode.SecretStorage): Promise<void> {
  await secrets.delete(JAR_KEY);
}

export function getUsername(state: vscode.Memento): string | undefined {
  return state.get<string>(USERNAME_KEY);
}

export async function setUsername(
  state: vscode.Memento,
  username: string
): Promise<void> {
  await state.update(USERNAME_KEY, username);
}
