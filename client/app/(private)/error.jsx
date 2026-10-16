'use client';

import { ErrorScreen } from '../../components/StatusViews.jsx';

export default function PrivateError({ reset }) {
  return <ErrorScreen reset={reset} fullPage />;
}
