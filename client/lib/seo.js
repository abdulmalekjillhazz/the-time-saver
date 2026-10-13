// SEO helpers. Pure functions, so they are unit tested.
// Fixes RELEASE-v2.md audit item 8: a production build must not silently fall back to
// localhost — that would ship wrong canonical URLs, sitemap, and JSON-LD to real users.
// In production, a missing NEXT_PUBLIC_SITE_URL now fails the build loudly instead.
if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_SITE_URL) {
  throw new Error(
    'NEXT_PUBLIC_SITE_URL is not set. Set it in client/.env.local (or your host\'s env vars) before building for production.'
  );
}
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
export const BRAND = 'Smart Routine';
export const LANGS = ['bn', 'en'];
export const DEFAULT_LANG = 'bn';

export const isLang = (value) => LANGS.includes(value);
// Slugs come from the URL. Only lowercase letters, digits, and hyphens are allowed, so nothing odd reaches the API.
export const isSafeSlug = (value) => typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 80;

// Bangla pages stay out of search until a native speaker has reviewed the copy (SEO_BN_INDEXABLE=true).
export const bnIndexable = () => process.env.SEO_BN_INDEXABLE === 'true';
export const indexable = (lang) => lang === 'en' || bnIndexable();

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

// Titles are at most 60 characters, the length search engines show. The brand goes last, and the text is shortened if needed.
export function titleWith(text) {
  const full = `${text} | ${BRAND}`;
  if ([...full].length <= 60) return full;
  const room = 60 - [...` | ${BRAND}`].length - 1;
  return `${[...text].slice(0, room).join('').trimEnd()}… | ${BRAND}`;
}

// Descriptions aim for 140 to 160 characters. Longer text is cut at a word boundary and marked with an ellipsis.
export function makeDescription(text, max = 160) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  const chars = [...clean];
  if (chars.length <= max) return clean;
  const cut = chars.slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > 100 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export function pageMetadata({ lang, path = '', title, description, index = indexable(lang) }) {
  const url = absUrl(lang, path);
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: 'website',
      siteName: BRAND,
      title,
      description,
      url,
      locale: lang === 'bn' ? 'bn_BD' : 'en_US',
      alternateLocale: lang === 'bn' ? ['en_US'] : ['bn_BD'],
      images: [{
        url: absUrl(lang, '/opengraph-image'),
        width: 1200,
        height: 630,
        alt: `${BRAND} — ${title}`,
      }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [absUrl(lang, '/opengraph-image')] },
  };
}

// Private screens: never indexed, never followed.
export function privateMetadata(title) {
  return { metadataBase: new URL(SITE_URL), title: titleWith(title), robots: { index: false, follow: false } };
}

// Escapes characters that could close the script tag early.
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
