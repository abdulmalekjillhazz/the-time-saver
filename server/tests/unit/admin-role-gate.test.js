import { describe, expect, it } from 'vitest';
import { requireAdmin } from '../../src/middleware/roles.js';

const owner = { role: 'owner', email: 'Owner@Example.com', mfa: { enabled: false } };

describe('admin MFA gate', () => {
  it('requires MFA for every staff role, regardless of configured email', () => {
    const run = (user) => {
      let error;
      requireAdmin()({ user, session: null }, null, (nextError) => { error = nextError; });
      return error;
    };

    expect(run(owner).status).toBe(403);
    expect(run({ ...owner, mfa: { enabled: true }, email: 'another@example.com' }).status).toBe(403);
    expect(run({ ...owner, role: 'editor' }).status).toBe(403);
    expect(run({ ...owner, role: 'user' }).status).toBe(403);
  });

  it('allows staff with MFA verified during the current session', () => {
    let error;
    requireAdmin()({
      user: { ...owner, mfa: { enabled: true } },
      session: { mfaVerifiedAt: new Date().toISOString() },
    }, null, (nextError) => { error = nextError; });
    expect(error).toBeUndefined();
  });
});
