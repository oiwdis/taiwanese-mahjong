/**
 * Boot whatever can listen on $PORT.
 *
 * Railway's @mahjong/client service often only keeps this folder at runtime.
 * The build step inlines the engine into server.bundle.mjs so we do not need
 * tsx or the sibling server/ tree after that.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(clientDir, 'server.bundle.mjs');
const source = path.resolve(clientDir, '../server/src/index.ts');

const args = existsSync(bundle)
  ? [bundle]
  : existsSync(source)
    ? ['--import', 'tsx', source]
    : null;

if (!args) {
  console.error('No server to start. server.bundle.mjs was not built.');
  process.exit(1);
}

const child = spawn(process.execPath, args, {
  cwd: existsSync(bundle) ? clientDir : path.resolve(clientDir, '..'),
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
