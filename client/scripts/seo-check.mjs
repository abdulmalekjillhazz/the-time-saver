// Audits rendered metadata, crawl directives, structured data, and sitemap behavior on a running build.
// BASE_URL defaults to the local production server; exits nonzero when an acceptance check fails.
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const EXPECT_BN_INDEXABLE = process.env.SEO_BN_INDEXABLE === 'true';
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
  if (!ok) failures.push(name);
};

async function get(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual', ...options });
  return { status: res.status, headers: res.headers, text: res.status < 300 ? await res.text() : '' };
}

const meta = (html, name) => (html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`)) || [])[1];
const property = (html, name) => (html.match(new RegExp(`<meta property="${name}" content="([^"]*)"`)) || [])[1];
const title = (html) => (html.match(/<title>([^<]*)<\/title>/) || [])[1];
const canonical = (html) => (html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i) || [])[1];
const ldJson = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .flatMap((match) => [JSON.parse(match[1])])
  .flat();
const hasNoindex = (html) => /noindex/i.test(meta(html, 'robots') || '');
const hasBreadcrumb = (html) => ldJson(html).some((item) => item['@type'] === 'BreadcrumbList');
const routes = [
  { path: '/en', index: true, title: 'home' },
  { path: '/en/about', index: true, title: 'about' },
  { path: '/en/help', index: true, title: 'help' },
  { path: '/en/lessons', dynamicIndex: true, title: 'lessons' },
  { path: '/en/privacy', index: false, title: 'privacy' },
  { path: '/en/terms', index: false, title: 'terms' },
];

const root = await get('/');
check('bare / permanently redirects to the default Bangla page', root.status === 308 && new URL(root.headers.get('location'), BASE).pathname === '/bn');

const englishPages = new Map();
for (const route of routes) {
  const page = await get(route.path);
  englishPages.set(route.path, page);
  check(`${route.path} returns 200`, page.status === 200, `status ${page.status}`);
  if (page.status !== 200) continue;

  check(`${route.path} declares English document language`, /<html lang="en"/.test(page.text));
  const pageTitle = title(page.text) || '';
  check(`${route.path} has a nonempty title no longer than 60 characters`, pageTitle.length > 0 && pageTitle.length <= 60, `${pageTitle.length} chars`);
  const description = meta(page.text, 'description') || '';
  check(`${route.path} has a 140–160 character description`, description.length >= 140 && description.length <= 160, `${description.length} chars`);
  check(`${route.path} has one clear H1`, (page.text.match(/<h1(?:\s|>)/g) || []).length === 1);
  check(`${route.path} has a self-referencing canonical`, canonical(page.text) === `${BASE}${route.path}`, canonical(page.text));
  check(`${route.path} has Open Graph and large Twitter share metadata`,
    Boolean(property(page.text, 'og:title')) &&
    Boolean(property(page.text, 'og:description')) &&
    property(page.text, 'og:url') === `${BASE}${route.path}` &&
    Boolean(property(page.text, 'og:image')) &&
    /summary_large_image/.test(meta(page.text, 'twitter:card') || '') &&
    Boolean(meta(page.text, 'twitter:image')));
  check(`${route.path} has breadcrumb structured data`, hasBreadcrumb(page.text));
  check(`${route.path} does not emit hreflang links to noindex Bangla pages`,
    EXPECT_BN_INDEXABLE || !/hreflang="bn-BD"/.test(page.text));

  if (route.dynamicIndex) {
    route.index = !hasNoindex(page.text);
    check(`${route.path} is indexable only when published lessons are available`, route.index || hasNoindex(page.text));
  } else {
    check(`${route.path} has the intended crawl directive`, hasNoindex(page.text) === !route.index, meta(page.text, 'robots'));
  }
}

const home = englishPages.get('/en');
if (home?.status === 200) {
  const structured = ldJson(home.text);
  check('home structured data includes Organization, WebApplication, and BreadcrumbList',
    structured.some((item) => item['@type'] === 'Organization') &&
    structured.some((item) => item['@type'] === 'WebApplication') &&
    structured.some((item) => item['@type'] === 'BreadcrumbList'));
}

const share = await fetch(`${BASE}/en/opengraph-image`, { redirect: 'manual' });
const imageBytes = new Uint8Array(await share.arrayBuffer());
const isPng = imageBytes.length >= 24 &&
  imageBytes[0] === 137 && imageBytes[1] === 80 && imageBytes[2] === 78 && imageBytes[3] === 71;
const imageView = isPng ? new DataView(imageBytes.buffer, imageBytes.byteOffset, imageBytes.byteLength) : null;
check('social share image is a valid 1200×630 PNG',
  share.status === 200 &&
  share.headers.get('content-type')?.includes('image/png') &&
  isPng &&
  imageView.getUint32(16) === 1200 &&
  imageView.getUint32(20) === 630,
  `status ${share.status}, type ${share.headers.get('content-type')}`);

const headers = home?.headers;
check('security headers present (CSP, HSTS, nosniff, frame deny)',
  Boolean(headers) &&
  /default-src 'self'/.test(headers.get('content-security-policy') || '') &&
  /max-age=/.test(headers.get('strict-transport-security') || '') &&
  headers.get('x-content-type-options') === 'nosniff' &&
  headers.get('x-frame-options') === 'DENY');

const bengali = await get('/bn');
check('/bn returns a page with Bengali document language', bengali.status === 200 && /<html lang="bn"/.test(bengali.text), `status ${bengali.status}`);
check('/bn indexing follows the reviewed-copy release switch', hasNoindex(bengali.text) === !EXPECT_BN_INDEXABLE, meta(bengali.text, 'robots'));

const app = await get('/app');
check('/app is noindex and nofollow', hasNoindex(app.text) && /nofollow/i.test(meta(app.text, 'robots') || ''), meta(app.text, 'robots'));

const robots = await get('/robots.txt');
check('robots.txt blocks private/API routes and publishes sitemap location',
  robots.status === 200 &&
  /Disallow: \/app/.test(robots.text) &&
  /Disallow: \/admin/.test(robots.text) &&
  /Disallow: \/api\//.test(robots.text) &&
  /Sitemap: .*\/sitemap\.xml/.test(robots.text));

const sitemap = await get('/sitemap.xml');
const sitemapUrls = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
check('sitemap is available and contains canonical English public URLs',
  sitemap.status === 200 && sitemapUrls.includes(`${BASE}/en`) && sitemapUrls.includes(`${BASE}/en/about`));
check('sitemap excludes private, API, and draft legal URLs',
  !sitemapUrls.some((url) => /\/(app|admin|api|privacy|terms)(\/|$)/.test(new URL(url).pathname)));
check('sitemap includes only approved language versions',
  EXPECT_BN_INDEXABLE || !sitemapUrls.some((url) => new URL(url).pathname.startsWith('/bn')));
check('sitemap excludes the empty/unavailable lessons archive when it is noindex',
  routeIndexable('/en/lessons') || !sitemapUrls.includes(`${BASE}/en/lessons`));
check('sitemap has hreflang only for indexable variants',
  EXPECT_BN_INDEXABLE || !/hreflang="bn-BD"/.test(sitemap.text));

const unsafeSlug = await get('/en/lessons/Not_A_Slug');
check('unsafe lesson slugs return 404', unsafeSlug.status === 404, `status ${unsafeSlug.status}`);
const unknownLesson = await get('/en/lessons/seo-check-nonexistent-lesson');
check('unpublished/missing lesson is either a 404 or an explicitly noindex unavailable page',
  unknownLesson.status === 404 || (unknownLesson.status === 200 && hasNoindex(unknownLesson.text)),
  `status ${unknownLesson.status}`);

const unknownLanguage = await get('/fr');
check('unknown languages return 404', unknownLanguage.status === 404, `status ${unknownLanguage.status}`);

function routeIndexable(path) {
  const page = englishPages.get(path);
  return page?.status === 200 && !hasNoindex(page.text);
}

console.log(failures.length ? `\n${failures.length} SEO check(s) failed.` : '\nAll SEO checks passed.');
process.exit(failures.length ? 1 : 0);
