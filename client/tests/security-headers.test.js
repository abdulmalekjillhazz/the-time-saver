import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config.mjs';

describe('application security headers', () => {
  it('allows microphone access on this origin for speech practice', async () => {
    const routeHeaders = await nextConfig.headers();
    const policy = routeHeaders
      .find(({ source }) => source === '/:path*')
      ?.headers.find(({ key }) => key === 'Permissions-Policy')?.value;

    expect(policy).toContain('camera=()');
    expect(policy).toContain('microphone=(self)');
  });
});
