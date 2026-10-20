import { Capacitor, registerPlugin } from '@capacitor/core';

const NativeSpeech = registerPlugin('NativeSpeech');

export function isAndroidNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function recognizeEnglishSpeech() {
  if (!isAndroidNativeApp()) {
    throw new Error('Native speech recognition is only available in the Android app.');
  }
  const result = await NativeSpeech.start();
  if (typeof result?.transcript !== 'string' || !result.transcript.trim()) {
    throw Object.assign(new Error('No speech was recognized.'), { code: 'NO_MATCH' });
  }
  return result.transcript.trim();
}

export async function stopEnglishSpeechRecognition() {
  if (!isAndroidNativeApp()) return null;
  return NativeSpeech.stop();
}
