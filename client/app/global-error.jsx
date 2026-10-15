'use client';

import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/600.css';
import '@fontsource/noto-sans-bengali/700.css';
import './globals.css';
import { ErrorScreen } from '../components/StatusViews.jsx';

export default function RootGlobalError({ error, reset }) {
  return (
    <html lang="bn">
      <body>
        <ErrorScreen error={error} reset={reset} fullPage />
      </body>
    </html>
  );
}
