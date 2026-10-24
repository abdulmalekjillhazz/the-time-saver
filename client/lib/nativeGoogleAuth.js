import { Capacitor } from '@capacitor/core';

/**
 * Android APK-এর ভেতর নেটিভ Google Sign-In সম্পাদন করে ID Token ফিরিয়ে দেয়।
 * @param {string} webClientId - Google Cloud Console থেকে প্রাপ্ত Web Client ID
 * @returns {Promise<string>} idToken
 */
export async function signInWithGoogleNative(webClientId) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    throw new Error('Native Google sign-in is only available in the Android app.');
  }

  if (typeof webClientId !== 'string' || !webClientId.trim()) {
    throw new Error('Google Web Client ID is not configured. Check your environment variables.');
  }

  try {
    const { SocialLogin } = await import('@capgo/capacitor-social-login');

    // প্লাগইন ইনিশিয়ালাইজেশন
    await SocialLogin.initialize({
      google: {
        webClientId: webClientId.trim(),
        mode: 'online',
      },
    });

    // নেটিভ গুগল প্লে সার্ভিসেস ডায়ালগ চালু করা
    const response = await SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['email', 'profile'],
      },
    });

    // রেসপন্স যাচাইকরণ (সব সম্ভাব্য শেপ সাপোর্ট করে)
    const result = response?.result || response;
    const idToken =
      result?.idToken ||
      result?.authentication?.idToken ||
      result?.accessToken?.idToken ||
      response?.idToken;

    if (!idToken || typeof idToken !== 'string') {
      throw new Error(
        'Google sign-in did not return a valid ID token. Ensure your Android SHA-1 is added in Google Cloud Console.'
      );
    }

    return idToken;
  } catch (error) {
    if (error?.message?.includes('cancel') || error?.code === 'canceled' || error?.code === '12501') {
      throw new Error('Google sign-in was canceled.');
    }
    throw error;
  }
}
