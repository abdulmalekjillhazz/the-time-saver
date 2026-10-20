import type { CapacitorConfig } from '@capacitor/cli';

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
  webDir: 'android-web',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || 'https://made-your-dream-bigger.vercel.app',
    cleartext: false,
  },
};

export default config;
