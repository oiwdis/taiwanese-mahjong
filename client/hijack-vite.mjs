/**
 * Point the `vite` binary at vite-wrapper.mjs so a dashboard start command
 * like `npx vite preview` still listens on $PORT.
 */
import { copyFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_PROJECT_ID) {
  process.exit(0);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const wrapper = path.join(here, 'vite-wrapper.mjs');
const require = createRequire(import.meta.url);

let viteBin;
try {
  viteBin = require.resolve('vite/bin/vite.js');
} catch {
  process.exit(0);
}

if (existsSync(wrapper) && existsSync(viteBin)) {
  const saved = path.join(path.dirname(viteBin), 'vite.real.js');
  if (!existsSync(saved)) copyFileSync(viteBin, saved);
  copyFileSync(wrapper, viteBin);
}
