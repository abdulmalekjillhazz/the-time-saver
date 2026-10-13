import { BRAND_BACKGROUND_URL } from '../lib/branding.js';

// Shared banner header for every public page: brand banner image kept visible
// under a dark readability gradient, gold eyebrow, white display title.
// Keeps one branding look site-wide on the true-black theme.
export function PageHero({ eyebrow, title, lead }) {
  return (
    <section
      className="app-hero relative isolate overflow-hidden rounded-3xl border border-gold/60 p-6 sm:p-10"
      style={{
        backgroundImage: `linear-gradient(100deg, rgb(0 0 0 / 72%), rgb(0 0 0 / 30%)), url("${BRAND_BACKGROUND_URL}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {eyebrow ? (
        <p className="eyebrow inline-flex items-center gap-2">
          <span className="brand-spark">✦</span>
          <span>{eyebrow}</span>
        </p>
      ) : null}
      <h1 className="display-1 mt-3 max-w-3xl">{title}</h1>
      {lead ? <p className="hero-description mt-4 max-w-2xl text-sm sm:text-base">{lead}</p> : null}
    </section>
  );
}
