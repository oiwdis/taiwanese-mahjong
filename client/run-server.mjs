/**
 * Start the real game server, even when Railway launches this
 * `@mahjong/client` workspace instead of the repo root.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(clientDir, '..');
const entry = path.join(root, 'server/src/index.ts');

if (!existsSync(entry)) {
  console.error(
    `Game server not found at ${entry}. In Railway, set this service's Root Directory to / (empty), not client/.`,
  );
  process.exit(1);
}

const child = spawn(process.execPath, ['--import', 'tsx', entry], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
