import { Capacitor } from '@capacitor/core';

export async function signInWithGoogleNative(webClientId) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    throw new Error('Native Google sign-in is only available in the Android app.');
  }
  if (typeof webClientId !== 'string' || !webClientId.trim()) {
    throw new Error('Google sign-in is not configured.');
  }

  const { SocialLogin } = await import('@capgo/capacitor-social-login');
  await SocialLogin.initialize({
    google: {
      webClientId,
      mode: 'online',
    },
  });
  const response = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile'] },
  });
  if (response.result?.responseType !== 'online' || typeof response.result.idToken !== 'string') {
    throw new Error('Google sign-in did not return an ID token. Please try again.');
  }

  return response.result.idToken;
}
