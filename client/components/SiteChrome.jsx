import Link from 'next/link';
import Image from 'next/image';
import { BRAND_LOGO_URL } from '../lib/branding.js';
import { ANDROID_APK_DOWNLOAD_URL } from '../lib/downloads.js';
import { MobileMenu } from './MobileMenu.jsx';

export function Header({ lang, dict }) {
  const otherLang = lang === 'bn' ? 'en' : 'bn';
  const otherLangLabel = lang === 'bn' ? 'English' : 'বাংলা';
  const logoAlt = lang === 'bn'
    ? 'Smart Routine — দৈনিক রুটিন প্ল্যানার ও অভ্যাস কোচ লোগো'
    : 'Smart Routine — Daily Routine Planner & Habit Coach Logo';

  return (
    <header className="public-site-header">
      <nav aria-label={dict.nav.label} className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href={`/${lang}`}
          aria-label={dict.brand}
          className="group inline-flex min-h-[44px] shrink-0 items-center gap-2.5 py-1 text-lg font-black tracking-tight text-gold transition-opacity hover:opacity-90 sm:text-xl"
        >
          <Image
            src={BRAND_LOGO_URL}
            alt={logoAlt}
            width={40}
            height={40}
            priority
            className="h-10 w-10 rounded-full border-2 border-gold/80 object-cover shadow-[0_0_12px_rgba(242,193,78,0.35)] transition-transform group-hover:scale-105"
          />
          <span className="tracking-tight">{dict.brand}</span>
        </Link>

        {/* Desktop Navigation Links */}
        <div className="hidden items-center gap-6 md:flex">
          <Link href={`/${lang}`} className="text-sm font-semibold text-ink/90 transition-colors hover:text-gold">
            {dict.nav.home}
          </Link>
          <Link href={`/${lang}/lessons`} className="text-sm font-semibold text-ink/90 transition-colors hover:text-gold">
            {dict.nav.lessons}
          </Link>
          <Link href={`/${lang}/about`} className="text-sm font-semibold text-ink/90 transition-colors hover:text-gold">
            {dict.nav.about}
          </Link>
          <Link href={`/${lang}/help`} className="text-sm font-semibold text-ink/90 transition-colors hover:text-gold">
            {dict.nav.help}
          </Link>
        </div>

        {/* Action Group: Desktop + Mobile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href={`/${otherLang}`}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold text-gold transition-all hover:bg-gold/20 hover:scale-105"
            title={`Switch to ${otherLangLabel}`}
          >
            <span aria-hidden="true">🌐</span>
            <span>{otherLangLabel}</span>
          </Link>

          <a
            href={ANDROID_APK_DOWNLOAD_URL}
            download
            className="hidden min-h-[38px] items-center gap-1.5 rounded-xl border border-gold/50 bg-paper/60 px-3.5 py-1.5 text-xs font-bold text-gold transition-all hover:border-gold hover:bg-gold/15 lg:inline-flex"
            title={dict.nav.downloadAndroid}
          >
            <span aria-hidden="true">📱</span>
            <span>APK v1.15</span>
          </a>

          <Link
            href="/app"
            className="hidden min-h-[38px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-1.5 text-xs font-black text-slate-950 shadow-[0_0_12px_rgba(242,193,78,0.35)] transition-all hover:scale-105 hover:shadow-[0_0_18px_rgba(242,193,78,0.55)] active:scale-95 sm:inline-flex"
          >
            <span>🚀</span>
            <span>{dict.nav.app}</span>
          </Link>

          <MobileMenu label={dict.nav.menu} closeLabel={dict.nav.close}>
            <Link href={`/${lang}`} className="min-h-[44px] py-2 font-medium">{dict.nav.home}</Link>
            <Link href={`/${lang}/lessons`} className="min-h-[44px] py-2 font-medium">{dict.nav.lessons}</Link>
            <Link href={`/${lang}/about`} className="min-h-[44px] py-2 font-medium">{dict.nav.about}</Link>
            <Link href={`/${lang}/help`} className="min-h-[44px] py-2 font-medium">{dict.nav.help}</Link>
            <a href={ANDROID_APK_DOWNLOAD_URL} download className="min-h-[44px] py-2 font-medium">
              📱 {dict.nav.downloadAndroid}
            </a>
            <Link href="/app" className="min-h-[44px] rounded-lg bg-gold px-4 py-2 font-semibold text-on-gold">
              🚀 {dict.nav.app}
            </Link>
          </MobileMenu>
        </div>
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
          <Link href={`/${lang}/lessons`}>{dict.nav.lessons}</Link>
          <Link href={`/${lang}/about`}>{dict.nav.about}</Link>
          <Link href={`/${lang}/privacy`}>{dict.footer.privacy}</Link>
          <Link href={`/${lang}/terms`}>{dict.footer.terms}</Link>
          <Link href={`/${lang}/help`}>{dict.footer.help}</Link>
          <a href={ANDROID_APK_DOWNLOAD_URL} download>{dict.nav.downloadAndroid}</a>
        </nav>
      </div>
    </footer>
  );
}
