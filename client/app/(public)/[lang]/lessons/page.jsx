import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, pageMetadata, titleWith, makeDescription, absUrl, breadcrumbData } from '../../../../lib/seo.js';
import { getDictionary } from '../../../../i18n/dictionaries.js';
import { getLessons, getTodayLesson } from '../../../../lib/api.js';
import { JsonLd } from '../../../../components/JsonLd.jsx';
import { DailyLessonCard } from '../../../../components/DailyLessonCard.jsx';
import { PageHero } from '../../../../components/PageHero.jsx';

export async function generateMetadata(props) {
  const params = await props.params;
  if (!isLang(params.lang)) return {};
  const d = getDictionary(params.lang).lessons;
  const result = await getLessons();
  const hasPublishedLessons = result.ok && result.lessons.length > 0;
  return pageMetadata({
    lang: params.lang,
    path: '/lessons',
    title: titleWith(d.title),
    description: d.description,
    index: hasPublishedLessons && (params.lang === 'en' || process.env.SEO_BN_INDEXABLE === 'true'),
  });
}

export default async function LessonsPage(props) {
  const params = await props.params;
  if (!isLang(params.lang)) notFound();
  const lang = params.lang;
  const d = getDictionary(lang).lessons;
  const [result, todayResult] = await Promise.all([
    getLessons(),
    getTodayLesson(lang),
  ]);

  const list = result.ok && result.lessons.length > 0 ? (
    <ul className="mt-6 space-y-4">
      {result.lessons.map((l) => (
        <li key={l.slug} className="routine-tile p-4">
          <h2 className="text-xl font-semibold">
            <Link href={`/${lang}/lessons/${l.slug}`} className="link-azure">{l.title[lang]}</Link>
          </h2>
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-6">{result.ok ? d.empty : d.unavailable}</p>
  );

  const breadcrumbs = breadcrumbData(lang, [
    { name: getDictionary(lang).brand, path: '' },
    { name: d.h1, path: '/lessons' },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <PageHero eyebrow={getDictionary(lang).brand} title={d.h1} lead={makeDescription(d.description, 160)} />

      {todayResult.ok && todayResult.dailyLesson && (
        <div className="mt-8">
          <DailyLessonCard dailyLesson={todayResult.dailyLesson} quiz={todayResult.quiz} lang={lang} />
        </div>
      )}

      <h2 className="section-heading mt-10 text-2xl">{lang === 'bn' ? 'সকল পাঠের সংগ্রহ' : 'All Published Lessons'}</h2>
      {list}
    </>
  );
}
