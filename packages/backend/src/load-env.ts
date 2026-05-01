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
 * `Rento/deploy/.env` — общий для docker-compose; путь от корня монорепо (без буквы диска).
 * `backend` → `..` → `packages` → `..` → корень репозитория.
 */
function resolveMonorepoDeployEnvPath(): string | null {
  if (!backendRoot) {
    return join(cwd, 'deploy', '.env');
  }
  const repoRoot = resolve(backendRoot, '..', '..');
  const p = join(repoRoot, 'deploy', '.env');
  return p;
}

const deployEnvPath = resolveMonorepoDeployEnvPath();

/**
 * Сначала полный `packages/backend/.env`, затем cwd-запасные, в конце `deploy/.env` с тем же ключом —
 * переопределит только переменные, присутствующие в `deploy/.env` (геоключ и др.), без удаления DATABASE_URL и пр.
 *
 * По очереди `override: true`: иначе пустые переменные из терминала мешают подставить значения из файла.
 */
const envChain = [
  packageEnvPath,
  join(cwd, 'packages', 'backend', '.env'),
  join(cwd, '.env'),
  ...(deployEnvPath ? [deployEnvPath] : []),
];

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
  /** dotenv парсит кавычки/пробелы так же, как config({ path }). */
  const parsed = parse(buf);
  const raw = parsed.YANDEX_GEOCODER_API_KEY;
  const v = typeof raw === 'string' ? raw.replace(/^\uFEFF/, '').trim() : '';
  if (v) {
    process.env.YANDEX_GEOCODER_API_KEY = v;
  }
}

for (const envPath of envChain) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: true });
  }
}

/** Если ни одного целевого файла не было — пробуем стандартное поведение dotenv для cwd. */
if (!envChain.some((p) => existsSync(p))) {
  config();
}

/** Явная подстановка геоключа по цепочке (последний файл с ключом побеждает). */
for (const p of envChain) {
  tryApplyYandexKeyFromFile(p);
}
