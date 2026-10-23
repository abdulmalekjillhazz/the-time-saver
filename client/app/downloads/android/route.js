const CLOUDINARY_APK_URL = 'https://res.cloudinary.com/fnxzbafx/raw/upload/v1792756043/smart-routine/downloads/smart-routine-android-v1-5-20261023.zip';

export const runtime = 'nodejs';

export async function GET() {
  if (process.env.CAPACITOR_BUNDLE === '1') {
    return new Response('Not found', { status: 404 });
  }

  const upstream = await fetch(CLOUDINARY_APK_URL, { cache: 'no-store' });
  if (!upstream.ok || !upstream.body) {
    throw new Error(`Cloudinary APK download failed (${upstream.status}).`);
  }

  const headers = new Headers({
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Disposition': 'attachment; filename="Smart-Routine-Android-v1.5.apk"',
    'Cache-Control': 'public, max-age=3600',
  });
  const contentLength = upstream.headers.get('content-length');
  if (contentLength) headers.set('Content-Length', contentLength);

  return new Response(upstream.body, { headers });
}
