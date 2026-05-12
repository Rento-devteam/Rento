import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { config, parse } from 'dotenv';

/** Текущая рабочая директория — откуда чаще всего стартуют `nest`/npm. */
const cwd = process.cwd();

/**
 * Каталог пакета `packages/backend` (рядом с `nest-cli.json`).
 * При `outDir=dist` исполняемый код в `dist/src/`, тогда `__dirname` = `.../dist/src`.
 */
function resolveBackendPackageRoot(): string | null {
  const oneUp = dirname(__dirname);
  const twoUp = dirname(oneUp);
  if (existsSync(join(twoUp, 'nest-cli.json'))) {
    return twoUp;
  }
  if (existsSync(join(oneUp, 'nest-cli.json'))) {
    return oneUp;
  }
  return null;
}

const backendRoot = resolveBackendPackageRoot();
const packageEnvPath = backendRoot
  ? join(backendRoot, '.env')
  : join(dirname(__dirname), '.env');

/**
 * `Rento/deploy/.env` — основной источник для Docker Compose и продакшена.
 */
function resolveMonorepoDeployEnvPath(): string {
  if (!backendRoot) {
    return join(cwd, 'deploy', '.env');
  }
  const repoRoot = resolve(backendRoot, '..', '..');
  return join(repoRoot, 'deploy', '.env');
}

const deployEnvPath = resolveMonorepoDeployEnvPath();

/** Кандидаты `packages/backend/.env` (локальная разработка; не перекрывают deploy). */
const backendEnvCandidates = [
  packageEnvPath,
  join(cwd, 'packages', 'backend', '.env'),
  join(cwd, '.env'),
];

const uniqueBackendEnvPaths = [...new Set(backendEnvCandidates)];

function loadEnvFile(absPath: string, override: boolean): void {
  if (existsSync(absPath)) {
    config({ path: absPath, override });
  }
}

/**
 * 1) Если есть `deploy/.env` — загружаем его с `override: true` (база для всех ключей).
 * 2) Затем `packages/backend/.env` и cwd-запасные с `override: false` — только ключи, которых ещё нет в `process.env`.
 *
 * Если `deploy/.env` нет — как раньше: первый найденный backend-файл с `override: true`, остальные с `override: false`.
 */
const deployExists = existsSync(deployEnvPath);

if (deployExists) {
  loadEnvFile(deployEnvPath, true);
  for (const p of uniqueBackendEnvPaths) {
    loadEnvFile(p, false);
  }
} else {
  let first = true;
  for (const p of uniqueBackendEnvPaths) {
    if (!existsSync(p)) {
      continue;
    }
    loadEnvFile(p, first);
    first = false;
  }
}

/** Если ни deploy, ни backend `.env` не найдены — стандартное поведение dotenv для cwd. */
if (!deployExists && !uniqueBackendEnvPaths.some((p) => existsSync(p))) {
  config();
}

function tryApplyYandexKeyFromFile(absPath: string): void {
  if (!existsSync(absPath)) {
    return;
  }
  let buf: Buffer;
  try {
    buf = readFileSync(absPath);
  } catch {
    return;
  }
  const parsed = parse(buf);
  const raw = parsed.YANDEX_GEOCODER_API_KEY;
  const v = typeof raw === 'string' ? raw.replace(/^\uFEFF/, '').trim() : '';
  if (v) {
    process.env.YANDEX_GEOCODER_API_KEY = v;
  }
}

/** Сначала backend-файлы, в конце `deploy/.env` — значение из deploy побеждает при разном содержимом. */
const yandexEnvScanOrder = [
  ...uniqueBackendEnvPaths,
  ...(deployExists ? [deployEnvPath] : []),
];

for (const p of yandexEnvScanOrder) {
  tryApplyYandexKeyFromFile(p);
}
