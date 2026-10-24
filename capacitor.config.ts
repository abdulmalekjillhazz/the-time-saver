import type { CapacitorConfig } from '@capacitor/cli';

const capacitorServerUrl = (
  process.env.CAPACITOR_SERVER_URL ||
  (process.env.CAPACITOR_BUNDLE === '1' ? 'https://made-your-dream-bigger.vercel.app' : '')
).replace(/\/+$/, '');

const config: CapacitorConfig = {
  appId: 'com.madeyourdreambigger.smartroutine',
  appName: 'Smart Routine',
  includePlugins: ['@capgo/capacitor-social-login'],
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
      logLevel: 1,
    },
  },
  webDir: 'client/out',
  ...(capacitorServerUrl
    ? {
        server: {
          url: `${capacitorServerUrl}/app`,
          cleartext: false,
        },
      }
    : {}),
};

export default config;
