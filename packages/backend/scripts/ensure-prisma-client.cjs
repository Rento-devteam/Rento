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

// Prisma generates the actual client into node_modules/.prisma/client.
// @prisma/client expects it to be available at node_modules/@prisma/client/.prisma/client
// but on some Windows setups the linkage may be missing. We copy the generated client as a fallback.
const projectRoot = path.resolve(__dirname, '..');
const generated = path.join(projectRoot, 'node_modules', '.prisma', 'client');
const expected = path.join(
  projectRoot,
  'node_modules',
  '@prisma',
  'client',
  '.prisma',
  'client',
);

if (!fs.existsSync(generated)) {
  console.error(`[ensure-prisma-client] Missing generated client at: ${generated}`);
  process.exit(1);
}

if (!fs.existsSync(expected)) {
  console.warn(
    `[ensure-prisma-client] Linking missing; copying Prisma client to: ${expected}`,
  );
  copyRecursive(generated, expected);
}

