/**
 * Repo-root entry. Railway's Docker image uses WORKDIR /app, so
 * `node ./start.mjs` must exist here — not only under server/.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

const files = [
  path.join(here, 'client/server.bundle.mjs'),
  path.join(here, 'server/server.bundle.mjs'),
  path.join(here, 'server.bundle.mjs'),
  path.join(cwd, 'client/server.bundle.mjs'),
  path.join(cwd, 'server/server.bundle.mjs'),
  path.join(cwd, 'server.bundle.mjs'),
  path.join(here, 'server/src/index.ts'),
  path.join(cwd, 'src/index.ts'),
];

const file = files.find((candidate) => existsSync(candidate));
if (!file) {
  console.error('No mahjong server bundle found from', here, 'or', cwd);
  process.exit(1);
}

const args = file.endsWith('.ts') ? ['--import', 'tsx', file] : [file];
const workdir = file.endsWith('.ts') ? path.resolve(path.dirname(file), '..') : path.dirname(file);
const child = spawn(process.execPath, args, {
  cwd: workdir,
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
