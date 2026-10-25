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
    const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
    if (
      code === 'user_cancelled'
      || code === 'user_canceled'
      || code === 'canceled'
      || code === 'cancelled'
      || code === 'sign_in_cancelled'
      || code === 'sign_in_canceled'
      || code === 'cancelled_by_user'
      || code === 'canceled_by_user'
      || code === '12501'
      || /google sign[\s-]?in (?:was )?cancel{1,2}ed by (?:the )?user/i.test(error?.message || '')
    ) {
      throw Object.assign(new Error('Google sign-in was canceled.', { cause: error }), {
        code: 'USER_CANCELLED',
      });
    }
    throw error;
  }
}
