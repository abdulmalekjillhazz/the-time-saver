import { describe, expect, it } from 'vitest';
import { requireUserProfile } from '../lib/userProfile.js';

describe('user profile response validation', () => {
  it('returns a valid profile from an API response', () => {
    const user = { id: 'user-1', displayName: 'Ayesha' };
    expect(requireUserProfile({ user })).toBe(user);
  });

  it.each([
    undefined,
    null,
    {},
    { user: null },
    { user: { id: 'user-1' } },
    { user: { displayName: 'Ayesha' } },
    { user: [] },
  ])('rejects a missing or incomplete user profile: %j', (payload) => {
    expect(() => requireUserProfile(payload)).toThrow(
      expect.objectContaining({
        code: 'INVALID_USER_RESPONSE',
        status: 200,
      }),
    );
  });
});
