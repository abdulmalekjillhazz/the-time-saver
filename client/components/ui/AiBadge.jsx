import { getUi } from '../../i18n/ui.js';

// Small personal mark for local AI features, in both languages.
export function AiBadge({ lang }) {
  return (
    <span
      className="ai-lightmark"
      role="img"
      aria-label={getUi(lang).aiBadge}
      title={getUi(lang).aiBadge}
    >
      <span className="ai-lightmark__text">AM</span>
    </span>
  );
}
