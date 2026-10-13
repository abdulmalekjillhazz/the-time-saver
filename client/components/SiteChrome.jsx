import Link from 'next/link';
import Image from 'next/image';
import { BRAND_LOGO_URL } from '../lib/branding.js';
import { MobileMenu } from './MobileMenu.jsx';

export function Header({ lang, dict }) {
  const otherLang = lang === 'bn' ? 'en' : 'bn';
  const otherLangLabel = lang === 'bn' ? 'English' : 'বাংলা';

  return (
    <header className="public-site-header">
      <nav aria-label={dict.nav.label} className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4 py-3">
        <Link href={`/${lang}`} aria-label={dict.brand} className="inline-flex min-h-[44px] items-center gap-3 py-1 text-xl font-extrabold tracking-tight text-gold">
          <Image
            src={BRAND_LOGO_URL}
            alt=""
            width={48}
            height={48}
            priority
            className="h-12 w-12 rounded-full border-2 border-gold/80 object-cover shadow-md"
          />
          <span>{dict.brand}</span>
        </Link>

        <div className="flex items-center gap-3 md:order-last">
          {/* Global Language Switcher Button */}
          <Link
            href={`/${otherLang}`}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold transition-colors hover:bg-gold/20"
            title={`Switch to ${otherLangLabel}`}
          >
            <span>🌐</span>
            <span>{otherLangLabel}</span>
          </Link>

          <Link
            href="/app"
            className="hidden min-h-[40px] items-center rounded-xl bg-gold px-4 py-2 text-sm font-bold text-on-gold shadow-sm hover:opacity-95 sm:inline-flex"
          >
            {dict.nav.app}
          </Link>
        </div>

        <MobileMenu label={dict.nav.menu} closeLabel={dict.nav.close}>
          <Link href={`/${lang}/lessons`} className="min-h-[44px] py-2 font-medium">{dict.nav.lessons}</Link>
          <Link href={`/${lang}/about`} className="min-h-[44px] py-2 font-medium">{dict.nav.about}</Link>
          <Link href={`/${lang}/help`} className="min-h-[44px] py-2 font-medium">{dict.nav.help}</Link>
          <Link href="/app" className="min-h-[44px] rounded-lg bg-gold px-4 py-2 font-semibold text-on-gold sm:hidden">
            {dict.nav.app}
          </Link>
        </MobileMenu>
      </nav>
    </header>
  );
}

export function Footer({ lang, dict }) {
  return (
    <footer className="public-site-footer">
      <div className="public-site-footer-inner">
        <span className="public-site-footer-brand">{dict.footer.note}</span>
        <nav aria-label={dict.footer.label} className="public-site-footer-links">
          <Link href={`/${lang}/privacy`}>{dict.footer.privacy}</Link>
          <Link href={`/${lang}/terms`}>{dict.footer.terms}</Link>
          <Link href={`/${lang}/help`}>{dict.footer.help}</Link>
        </nav>
      </div>
    </footer>
  );
}
