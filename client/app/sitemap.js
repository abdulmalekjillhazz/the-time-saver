import { LANGS, absUrl, indexable, languageAlternates } from '../lib/seo.js';
import { getLessons } from '../lib/api.js';

const STATIC_ROUTES = [
  { path: '', changeFrequency: 'daily', priority: 1.0 },
  { path: '/lessons', changeFrequency: 'daily', priority: 0.9 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.7 },
];

export default async function sitemap() {
  const entries = [];
  const langs = LANGS.filter((l) => indexable(l));
  const now = new Date();
  const lessons = await getLessons();
  const hasLessons = lessons.ok && Array.isArray(lessons.lessons) && lessons.lessons.length > 0;

  for (const route of STATIC_ROUTES) {
    if (route.path === '/lessons' && !hasLessons) continue;
    for (const lang of langs) {
      entries.push({
        url: absUrl(lang, route.path),
        lastModified: now,
        changeFrequency: route.changeFrequency,
        priority: route.priority,
        alternates: { languages: languageAlternates(route.path) },
      });
    }
  }

  if (hasLessons) {
    for (const l of lessons.lessons) {
      for (const lang of langs) {
        entries.push({
          url: absUrl(lang, `/lessons/${l.slug}`),
          lastModified: l.publishedAt ? new Date(l.publishedAt) : now,
          changeFrequency: 'weekly',
          priority: 0.8,
          alternates: { languages: languageAlternates(`/lessons/${l.slug}`) },
        });
      }
    }
  }
  return entries;
}
