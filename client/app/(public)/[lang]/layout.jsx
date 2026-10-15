import { notFound } from 'next/navigation';
import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/600.css';
import '@fontsource/noto-sans-bengali/700.css';
import { LANGS, isLang, SITE_URL, BRAND, absUrl } from '../../../lib/seo.js';
import { getDictionary } from '../../../i18n/dictionaries.js';
import { Header, Footer } from '../../../components/SiteChrome.jsx';
import { JsonLd } from '../../../components/JsonLd.jsx';
import '../../globals.css';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: BRAND,
  manifest: '/manifest.webmanifest',
};

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export default async function PublicLayout(props) {
  const params = await props.params;
  const { children } = props;

  if (!isLang(params.lang)) notFound();
  const lang = params.lang;
  const dict = getDictionary(lang);

  const siteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND,
    alternateName: lang === 'bn' ? 'স্মার্ট রুটিন — দৈনিক রুটিন ও অভ্যাস কোচ' : 'Smart Routine — Daily Routine Planner & Habit Coach',
    url: absUrl(lang, ''),
    inLanguage: lang === 'bn' ? 'bn-BD' : 'en-US',
    publisher: {
      '@type': 'Organization',
      name: BRAND,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
  };

  return (
    <html lang={lang}>
      <body>
        <JsonLd data={siteSchema} />
        <a href="#main" className="sr-only focus:not-sr-only focus:p-2">
          {lang === 'bn' ? 'মূল বিষয়বস্তুতে যান' : 'Skip to content'}
        </a>
        <Header lang={lang} dict={dict} />
        <main id="main" className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <Footer lang={lang} dict={dict} />
      </body>
    </html>
  );
}
