/**
 * Pack the game server into this package so a Railway service that only
 * has `client/` can still listen on $PORT.
 */
import * as esbuild from 'esbuild';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.resolve(here, '../server/src/index.ts');

if (!existsSync(entry)) {
  console.error(`Cannot bundle the server: ${entry} is missing.`);
  process.exit(1);
}

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: path.join(here, 'server.bundle.mjs'),
  banner: {
    js: "import { createRequire } from 'node:module'; import { fileURLToPath as __bannerFileURLToPath } from 'node:url'; import { dirname as __bannerDirname } from 'node:path'; const require = createRequire(import.meta.url); const __filename = __bannerFileURLToPath(import.meta.url); const __dirname = __bannerDirname(__filename);",
  },
  logLevel: 'info',
});
