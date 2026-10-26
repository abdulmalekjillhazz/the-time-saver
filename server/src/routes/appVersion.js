import { Router } from 'express';

export function appVersionRouter() {
  const r = Router();

  r.get('/version', (_req, res) => {
    const latestVersion = process.env.LATEST_ANDROID_VERSION || '1.16';
    const latestBuild = Number(process.env.LATEST_ANDROID_BUILD || 16);
    const minSupportedBuild = Number(process.env.MIN_SUPPORTED_ANDROID_BUILD || 1);
    const downloadUrl = process.env.ANDROID_APK_DOWNLOAD_URL || '/downloads/android';

    res.json({
      ok: true,
      platform: 'android',
      latestVersion,
      latestBuild,
      minSupportedBuild,
      downloadUrl,
      forceUpdate: false,
      releaseNotes: {
        bn: 'উচ্চারণ অনুশীলনের অবাঞ্ছিত ব্যাকগ্রাউন্ড সাউন্ড বন্ধ ও ডুওলিঙ্গো স্টাইল প্র্যাকটিস আপডেট (v1.16)',
        en: 'Pronunciation practice background audio silence fix and Duolingo-style mic update (v1.16)',
      },
      publishedAt: '2026-10-26T20:15:00.000Z',
    });
  });

  return r;
}

