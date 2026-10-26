import { Router } from 'express';

export function appVersionRouter() {
  const r = Router();

  r.get('/version', (_req, res) => {
    const latestVersion = process.env.LATEST_ANDROID_VERSION || '1.15';
    const latestBuild = Number(process.env.LATEST_ANDROID_BUILD || 15);
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
        bn: 'নতুন ডুওলিঙ্গো-স্টাইল ফুল-স্ক্রিন স্পিকিং প্র্যাকটিস ও অ্যাডমিন ইউজার ম্যানেজমেন্ট সিস্টেম!',
        en: 'New Duolingo-style full-screen speaking practice and admin user management system!',
      },
      publishedAt: '2026-10-26T00:00:00.000Z',
    });
  });

  return r;
}

