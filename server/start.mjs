import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(here, 'server.bundle.mjs');
const clientBundle = path.resolve(here, '../client/server.bundle.mjs');
const source = path.join(here, 'src/index.ts');

const args = existsSync(bundle)
  ? [bundle]
  : existsSync(clientBundle)
    ? [clientBundle]
    : existsSync(source)
      ? ['--import', 'tsx', source]
      : null;

if (!args) {
  console.error('No mahjong server to start.');
  process.exit(1);
}

const cwd = existsSync(bundle) ? here : existsSync(clientBundle) ? path.resolve(here, '..') : here;
const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: process.env });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
