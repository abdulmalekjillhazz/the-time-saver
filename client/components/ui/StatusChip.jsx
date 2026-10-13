import { getUi } from '../../i18n/ui.js';

// Shows a routine's state. Colour is never the only signal: every state also has a text label.
const STYLES = {
  done: 'bg-sapphire text-on-sapphire',
  missed: 'bg-gold text-on-gold',
  skipped: 'border border-ink text-ink bg-transparent',
  draft: 'border border-ink text-ink bg-transparent',
  review: 'bg-gold text-on-gold',
  published: 'bg-sapphire text-on-sapphire',
  archived: 'border border-ink/50 text-ink bg-paper',
};

export function StatusChip({ lang, status }) {
  const labels = getUi(lang).status;
  const label = labels[status] ?? status;
  const style = STYLES[status] ?? STYLES.skipped;
  return (
    <span className={`inline-flex min-h-[28px] items-center rounded-md px-3 text-sm font-semibold ${style}`}>
      {label}
    </span>
  );
}
