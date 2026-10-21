import { SITE_URL } from '../lib/seo.js';

export const dynamic = 'force-static';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/bn', '/en', '/bn/lessons', '/en/lessons', '/bn/about', '/en/about', '/bn/help', '/en/help'],
        disallow: ['/app', '/admin', '/api/'],
      },
      {
        userAgent: ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'PerplexityBot', 'ClaudeBot'],
        allow: ['/'],
        disallow: ['/app', '/admin', '/api/'],
      },
    ],
    host: SITE_URL,
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
