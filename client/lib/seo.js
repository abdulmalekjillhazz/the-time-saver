// SEO helpers for Next.js App Router (2026 Technical SEO & GEO Best Practices).
const DEFAULT_PROD_URL = 'https://made-your-dream-bigger.vercel.app';

export const SITE_URL = (() => {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  if (process.env.NODE_ENV === 'production') {
    if (!raw) return DEFAULT_PROD_URL;

    const configured = new URL(raw);
    const isLocal = configured.hostname === 'localhost' || configured.hostname === '127.0.0.1';
    const isDeploymentAlias = configured.hostname.endsWith('.vercel.app') &&
      configured.hostname !== new URL(DEFAULT_PROD_URL).hostname;
    if (isLocal || isDeploymentAlias) return DEFAULT_PROD_URL;
    return configured.origin;
  }
  return raw || DEFAULT_PROD_URL;
})();

export const BRAND = 'Smart Routine';
export const LANGS = ['bn', 'en'];
export const DEFAULT_LANG = 'bn';

export const isLang = (value) => LANGS.includes(value);
export const isSafeSlug = (value) => typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 80;

export const bnIndexable = () => true;
export const indexable = (lang) => lang === 'en' || (lang === 'bn' && bnIndexable());

export const absUrl = (lang, path = '') => `${SITE_URL}/${lang}${path}`;

export function languageAlternates(path = '') {
  const alternatives = {};
  for (const lang of LANGS.filter(indexable)) {
    alternatives[lang === 'bn' ? 'bn-BD' : 'en'] = absUrl(lang, path);
  }
  const defaultLang = indexable(DEFAULT_LANG) ? DEFAULT_LANG : 'en';
  alternatives['x-default'] = absUrl(defaultLang, path);
  return alternatives;
}

export function titleWith(text) {
  const full = `${text} | ${BRAND}`;
  if ([...full].length <= 60) return full;
  const room = 60 - [...` | ${BRAND}`].length - 1;
  return `${[...text].slice(0, room).join('').trimEnd()}… | ${BRAND}`;
}

export function makeDescription(text, max = 160) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  const chars = [...clean];
  if (chars.length <= max) return clean;
  const cut = chars.slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > 100 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export const DEFAULT_KEYWORDS = {
  bn: [
    'দৈনিক রুটিন প্ল্যানার',
    'স্মার্ট রুটিন',
    'অভ্যাস ট্র্যাকার অ্যাপ',
    'সময় ব্যবস্থাপনা',
    'নামাজের সময়সূচী ও রুটিন',
    'ইংরেজি শেখার গল্প ও কুইজ',
    'Smart Routine Bangladesh',
    'daily routine planner Bangla',
  ],
  en: [
    'daily routine planner',
    'habit tracker app',
    'smart routine planner',
    'time block planner',
    'daily habit lessons and quizzes',
    'bilingual habit coach Bangla English',
    'offline routine tracker PWA',
    'Smart Routine',
  ],
};

export function pageMetadata({ lang, path = '', title, description, keywords, index = indexable(lang), ogType = 'website' }) {
  const url = absUrl(lang, path);
  const kw = Array.isArray(keywords) && keywords.length ? keywords : (DEFAULT_KEYWORDS[lang] || DEFAULT_KEYWORDS.en);
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: BRAND,
    title,
    description,
    keywords: kw,
    authors: [{ name: BRAND, url: SITE_URL }],
    creator: BRAND,
    publisher: BRAND,
    category: 'productivity',
    formatDetection: { email: false, address: false, telephone: false },
    alternates: {
      canonical: url,
      ...(index ? { languages: languageAlternates(path) } : {}),
    },
    robots: index
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        }
      : { index: false, follow: true },
    openGraph: {
      type: ogType,
      siteName: BRAND,
      title,
      description,
      url,
      locale: lang === 'bn' ? 'bn_BD' : 'en_US',
      alternateLocale: lang === 'bn' ? ['en_US'] : ['bn_BD'],
      images: [
        {
          url: absUrl(lang, '/social-image'),
          width: 1200,
          height: 630,
          alt: `${BRAND} — ${title}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absUrl(lang, '/social-image')],
    },
  };
}

export function privateMetadata(title) {
  return {
    metadataBase: new URL(SITE_URL),
    title: titleWith(title),
    icons: {
      icon: [{ url: '/brand-logo.png', type: 'image/png', sizes: '512x512' }],
      shortcut: '/brand-logo.png',
      apple: [{ url: '/brand-logo.png', sizes: '512x512', type: 'image/png' }],
    },
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
  };
}

export function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function breadcrumbData(lang, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(({ name, path }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: absUrl(lang, path),
    })),
  };
}
