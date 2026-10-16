'use client';

import { ErrorScreen } from '../../../components/StatusViews.jsx';

export default function PublicError({ reset }) {
  return <ErrorScreen reset={reset} />;
}
