import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/600.css';
import '@fontsource/noto-sans-bengali/700.css';
import '../globals.css';
import { privateMetadata } from '../../lib/seo.js';

// Private screens use their own root layout. Their pages are never indexed.
export const metadata = privateMetadata('Smart Routine App');

// Target SDK 36 draws edge-to-edge. viewport-fit=cover activates the
// env(safe-area-inset-*) values the app shell already uses, and adjustResize
// (manifest) keeps keyboard-visible forms above the keyboard.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#071426',
  colorScheme: 'dark light',
};

export default function PrivateLayout({ children }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <body className="private-app-body">{children}</body>
    </html>
  );
}
