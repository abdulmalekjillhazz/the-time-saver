import { LANGS, absUrl, indexable, languageAlternates } from '../lib/seo.js';
import { getLessons } from '../lib/api.js';

const STATIC_PATHS = ['', '/about', '/help'];

// Only indexable pages are listed. Each entry lists its language alternates.
export default async function sitemap() {
  const entries = [];
  const langs = LANGS.filter((l) => indexable(l));

  for (const path of STATIC_PATHS) {
    for (const lang of langs) {
      entries.push({ url: absUrl(lang, path), alternates: { languages: languageAlternates(path) } });
    }
  }
  const lessons = await getLessons();
  if (lessons.ok && lessons.lessons.length > 0) {
    for (const lang of langs) {
      entries.push({ url: absUrl(lang, '/lessons'), alternates: { languages: languageAlternates('/lessons') } });
    }
    for (const l of lessons.lessons) {
      for (const lang of langs) {
        entries.push({
          url: absUrl(lang, `/lessons/${l.slug}`),
          ...(l.publishedAt ? { lastModified: new Date(l.publishedAt) } : {}),
          alternates: { languages: languageAlternates(`/lessons/${l.slug}`) },
        });
      }
    }
  }
  return entries;
}
