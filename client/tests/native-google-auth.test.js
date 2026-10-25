import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { signInWithGoogleNative } from '../lib/nativeGoogleAuth.js';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(),
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: {
    initialize: vi.fn(),
    login: vi.fn(),
  },
}));

describe('native Android Google sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Capacitor.isNativePlatform.mockReturnValue(true);
    Capacitor.getPlatform.mockReturnValue('android');
  });

  it('uses Credential Manager and returns the server-verifiable web-client ID token', async () => {
    SocialLogin.login.mockResolvedValue({
      result: { responseType: 'online', idToken: 'google-id-token' },
    });

    await expect(signInWithGoogleNative('web-client-id')).resolves.toBe('google-id-token');
    expect(SocialLogin.initialize).toHaveBeenCalledWith({
      google: { webClientId: 'web-client-id', mode: 'online' },
    });
    expect(SocialLogin.login).toHaveBeenCalledWith({
      provider: 'google',
    });
  });

  it('rejects non-Android platforms without initializing native sign-in', async () => {
    Capacitor.getPlatform.mockReturnValue('web');

    await expect(signInWithGoogleNative('web-client-id')).rejects.toThrow(
      'Native Google sign-in is only available in the Android app.'
    );
    expect(SocialLogin.initialize).not.toHaveBeenCalled();
  });

  it('surfaces a missing token instead of sending an invalid login request', async () => {
    SocialLogin.login.mockResolvedValue({
      result: { responseType: 'online', idToken: null },
    });

    await expect(signInWithGoogleNative('web-client-id')).rejects.toThrow(
      'Google sign-in did not return a valid ID token. Ensure your Android SHA-1 is added in Google Cloud Console.'
    );
  });

  it('handles the cancellation code returned by the Android Google credential picker', async () => {
    SocialLogin.login.mockRejectedValue(
      Object.assign(new Error('Google Sign-In cancelled by user'), { code: 'USER_CANCELLED' }),
    );

    await expect(signInWithGoogleNative('web-client-id')).rejects.toThrow(
      'Google sign-in was canceled.',
    );
  });

  it('does not misreport a configuration failure just because its message mentions cancellation', async () => {
    const error = Object.assign(
      new Error('Google OAuth configuration failed while resolving the canceled credential flow.'),
      { code: 'CONFIGURATION_ERROR' },
    );
    SocialLogin.login.mockRejectedValue(error);

    await expect(signInWithGoogleNative('web-client-id')).rejects.toBe(error);
  });
});
