const ANDROID_APK_PATH = '/downloads/smart-routine-android-v1.16.apk';

export const runtime = 'nodejs';

export async function GET(request) {
  if (process.env.CAPACITOR_BUNDLE === '1') {
    return new Response('Not found', { status: 404 });
  }

  return Response.redirect(new URL(ANDROID_APK_PATH, request.url), 302);
}
