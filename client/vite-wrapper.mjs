/**
 * Railway's monorepo importer starts Vite (`vite preview`). That process
 * either binds localhost or is pruned from the image — both become a 502.
 * On Railway (or `vite preview`), boot the real game server instead.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const wantPreview = args.includes('preview') || args.includes('preview.js');

function findBundle() {
  const names = ['server.bundle.mjs', 'client/server.bundle.mjs'];
  const roots = [here, process.cwd(), '/app'];
  for (const root of roots) {
    for (const name of names) {
      const candidate = path.resolve(root, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

if (onRailway || wantPreview) {
  const bundle = findBundle();
  if (!bundle) {
    console.error('server.bundle.mjs not found; cannot start the game server.');
    process.exit(1);
  }
  await import(pathToFileURL(bundle).href);
} else {
  const realVite = [
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'vite.real.js'),
    path.join(here, 'node_modules/vite/bin/vite.js'),
    path.resolve(here, '../node_modules/vite/bin/vite.js'),
  ].find((file) => existsSync(file));
  if (!realVite) {
    console.error('Vite is not installed.');
    process.exit(1);
  }
  const child = spawn(process.execPath, [realVite, ...args], {
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}
