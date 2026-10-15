'use client';

import { ErrorScreen } from '../../../components/StatusViews.jsx';

export default function PublicError({ error, reset }) {
  return <ErrorScreen error={error} reset={reset} />;
}
