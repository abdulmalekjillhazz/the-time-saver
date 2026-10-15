import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.madeyourdreambigger.smartroutine',
  appName: 'Smart Routine',
  webDir: 'client/public',
  server: {
    url: process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://made-your-dream-bigger.vercel.app',
    cleartext: false,
  },
};

export default config;
