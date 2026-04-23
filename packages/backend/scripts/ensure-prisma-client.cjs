const fs = require('node:fs');
const path = require('node:path');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/** npm workspaces often hoist `node_modules` to a parent directory */
function candidateGeneratedDirs(projectRoot) {
  const roots = [
    projectRoot,
    path.join(projectRoot, '..'),
    path.join(projectRoot, '..', '..'),
  ];
  return roots.map((r) => path.resolve(r, 'node_modules', '.prisma', 'client'));
}

function findGeneratedClient(projectRoot) {
  for (const p of candidateGeneratedDirs(projectRoot)) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function resolveExpectedClientDir(projectRoot) {
  try {
    const pkgJson = require.resolve('@prisma/client/package.json', {
      paths: [projectRoot],
    });
    return path.join(path.dirname(pkgJson), '.prisma', 'client');
  } catch {
    return null;
  }
}

// Prisma generates into `node_modules/.prisma/client`. @prisma/client may expect
// `node_modules/@prisma/client/.prisma/client`; on some setups the link is missing — copy as fallback.
const projectRoot = path.resolve(__dirname, '..');
const generated = findGeneratedClient(projectRoot);
const expected = resolveExpectedClientDir(projectRoot);

if (!generated) {
  console.error(
    '[ensure-prisma-client] Missing generated client. Checked:\n  ' +
      candidateGeneratedDirs(projectRoot).join('\n  '),
  );
  process.exit(1);
}

if (!expected) {
  console.error(
    '[ensure-prisma-client] Could not resolve @prisma/client (run from packages/backend after install).',
  );
  process.exit(1);
}

if (!fs.existsSync(expected)) {
  console.warn(
    `[ensure-prisma-client] Linking missing; copying Prisma client from\n  ${generated}\n  →\n  ${expected}`,
  );
  copyRecursive(generated, expected);
}
