import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readdirSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
const downloadRoute = resolve(process.cwd(), 'app', 'downloads', 'android', 'route.js');
const temporarilyDisabledRoute = resolve(process.cwd(), '.android-download-route.js');

renameSync(downloadRoute, temporarilyDisabledRoute);
let result;
try {
  result = spawnSync(process.execPath, [nextCli, 'build'], {
    cwd: process.cwd(),
    env: { ...process.env, CAPACITOR_BUNDLE: '1' },
    stdio: 'inherit',
  });
} finally {
  renameSync(temporarilyDisabledRoute, downloadRoute);
}

if (result.error) throw result.error;
if (result.status === 0) {
  const downloadsDirectory = resolve(process.cwd(), 'out', 'downloads');
  for (const entry of readdirSync(downloadsDirectory, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.apk')) {
      rmSync(resolve(downloadsDirectory, entry.name), { force: true });
    }
  }
}
process.exit(result.status ?? 1);
