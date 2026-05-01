import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { parse as parseDotenv } from 'dotenv';

export const YANDEX_GEOCODER_API_KEY_ENV = 'YANDEX_GEOCODER_API_KEY';

/** Подняться от каталога модуля до `packages/backend` (рядом `nest-cli.json`). */
export function climbToBackendPackageRoot(startDir: string): string | null {
  let d = startDir;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(d, 'nest-cli.json'))) {
      return d;
    }
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

function unquoteEnvValue(raw: string): string {
  const v = raw.trim();
  if (v.length >= 2) {
    const q = v[0];
    if ((q === '"' || q === "'") && v[v.length - 1] === q) {
      return v.slice(1, -1);
    }
  }
  return v;
}

/** Читает ключ из одного .env: сначала dotenv.parse, затем простая строка по regex (кириллица, UTF-16 и т.д.). */
function readDotenvFileUtf8(absPath: string): string | null {
  let buf: Buffer;
  try {
    buf = readFileSync(absPath);
  } catch {
    return null;
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf
      .subarray(2)
      .toString('utf16le')
      .replace(/^\uFEFF/, '');
  }
  return buf.toString('utf8').replace(/^\uFEFF/, '');
}

export function extractYandexKeyFromDotenvFile(absPath: string): string | null {
  if (!existsSync(absPath)) {
    return null;
  }
  const rawText = readDotenvFileUtf8(absPath);
  if (!rawText) {
    return null;
  }
  const withoutLeadingBom = rawText.replace(/^\uFEFF/, '');
  const parsed = parseDotenv(withoutLeadingBom);
  const fromParsed = parsed[YANDEX_GEOCODER_API_KEY_ENV];
  if (typeof fromParsed === 'string' && fromParsed.trim()) {
    return unquoteEnvValue(fromParsed.replace(/^\uFEFF/, '')).trim();
  }

  const text = withoutLeadingBom;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*YANDEX_GEOCODER_API_KEY\s*=\s*(.*?)\s*(?:#.*)?$/);
    if (m?.[1]) {
      const v = unquoteEnvValue(m[1]);
      if (v) return v.trim();
    }
  }
  return null;
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const n = resolve(p);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Все кандидаты .env, где логично искать геоключ (локально и в docker). */
export function getYandexGeocoderDotenvCandidates(
  moduleDirname: string,
): string[] {
  const cwd = process.cwd();
  const backendRoot = climbToBackendPackageRoot(moduleDirname);
  const list: string[] = [];

  if (backendRoot) {
    list.push(join(backendRoot, '.env'));
    list.push(join(backendRoot, '..', '..', 'deploy', '.env'));
  }
  list.push(join(cwd, 'deploy', '.env'));
  list.push(join(cwd, 'packages', 'backend', '.env'));
  list.push(join(cwd, '.env'));

  let d = resolve(cwd);
  for (let i = 0; i < 10; i++) {
    list.push(join(d, 'deploy', '.env'));
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }

  return uniquePaths(list);
}

/**
 * Если в `process.env` ключа нет — ищет в `.env` на диске и подставляет в env.
 * Нужен из-за вложенного `dist/src`, shell-обёрток и т.п.
 */
export function hydrateYandexGeocoderApiKeyFromDisk(
  moduleDirname: string,
): void {
  const cur = (process.env[YANDEX_GEOCODER_API_KEY_ENV] ?? '')
    .replace(/^\uFEFF/, '')
    .trim();
  if (cur) {
    return;
  }
  for (const p of getYandexGeocoderDotenvCandidates(moduleDirname)) {
    const k = extractYandexKeyFromDotenvFile(p);
    if (k) {
      process.env[YANDEX_GEOCODER_API_KEY_ENV] = k;
      return;
    }
  }
}

export function getYandexGeocoderApiKeyTrimmed(moduleDirname: string): string {
  hydrateYandexGeocoderApiKeyFromDisk(moduleDirname);
  return (process.env[YANDEX_GEOCODER_API_KEY_ENV] ?? '')
    .replace(/^\uFEFF/, '')
    .trim();
}
