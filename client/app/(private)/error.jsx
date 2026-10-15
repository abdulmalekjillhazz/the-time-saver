'use client';

import { ErrorScreen } from '../../components/StatusViews.jsx';

export default function PrivateError({ error, reset }) {
  return <ErrorScreen error={error} reset={reset} fullPage />;
}
