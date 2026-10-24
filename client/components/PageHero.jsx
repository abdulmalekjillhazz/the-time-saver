// Shared banner header for every public page: brand banner image kept visible
// under a dark readability gradient, gold eyebrow, white display title.
// Keeps one branding look site-wide on the true-black theme.
export function PageHero({ eyebrow, title, lead }) {
  return (
    <section
      className="page-hero-banner app-hero glass-panel glow-border relative isolate overflow-hidden rounded-3xl border border-gold/60 p-6 sm:p-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 -top-20 h-56 w-56 rounded-full bg-sapphire/25 blur-3xl float-soft"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-gold/20 blur-3xl"
      />

      {eyebrow ? (
        <p className="eyebrow relative inline-flex items-center gap-2">
          <span className="brand-spark idle-wobble drop-shadow-[0_0_6px_rgba(242,193,78,0.7)]">✦</span>
          <span>{eyebrow}</span>
        </p>
      ) : null}
      <h1 className="display-1 relative mt-3 max-w-3xl">{title}</h1>
      {lead ? (
        <p className="hero-description relative mt-4 max-w-2xl text-sm sm:text-base">{lead}</p>
      ) : null}
    </section>
  );
}
