import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
const result = spawnSync(process.execPath, [nextCli, 'build'], {
  cwd: process.cwd(),
  env: { ...process.env, CAPACITOR_BUNDLE: '1', CAPACITOR_SERVER_URL: '' },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
