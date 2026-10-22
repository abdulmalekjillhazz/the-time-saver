import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { renameSync, rmSync } from 'node:fs';
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
    env: { ...process.env, CAPACITOR_BUNDLE: '1', CAPACITOR_SERVER_URL: '' },
    stdio: 'inherit',
  });
} finally {
  renameSync(temporarilyDisabledRoute, downloadRoute);
}

if (result.error) throw result.error;
if (result.status === 0) {
  rmSync(resolve(process.cwd(), 'out', 'downloads', 'smart-routine-android.apk'), { force: true });
}
process.exit(result.status ?? 1);
