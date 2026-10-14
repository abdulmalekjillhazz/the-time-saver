import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLang, isSafeSlug, pageMetadata, titleWith, makeDescription, absUrl, breadcrumbData } from '../../../../../lib/seo.js';
import { getDictionary } from '../../../../../i18n/dictionaries.js';
import { getLesson, getLessons } from '../../../../../lib/api.js';
import { JsonLd } from '../../../../../components/JsonLd.jsx';
import { AudioDramaPlayer } from '../../../../../components/AudioDramaPlayer.jsx';
import { StoryReader } from '../../../../../components/StoryReader.jsx';
import { PageHero } from '../../../../../components/PageHero.jsx';

export const revalidate = 300;

// Pre-build the published lessons when the API is reachable. Otherwise pages are built on first request.
export async function generateStaticParams() {
  const result = await getLessons();
  if (!result.ok) return [];
  return result.lessons.flatMap((l) => [{ lang: 'bn', slug: l.slug }, { lang: 'en', slug: l.slug }]);
}

export async function generateMetadata(props) {
  const params = await props.params;
  if (!isLang(params.lang) || !isSafeSlug(params.slug)) return {};
  const result = await getLesson(params.slug);
  if (!result.ok) {
    // Not published, or temporarily unavailable: never index an error page.
    return { title: titleWith(getDictionary(params.lang).lessons.title), robots: { index: false, follow: true } };
  }
  const lang = params.lang;
  return pageMetadata({
    lang,
    path: `/lessons/${params.slug}`,
    title: titleWith(result.lesson.title[lang]),
    description: makeDescription(result.lesson.body[lang]),
  });
}

export default async function LessonPage(props) {
  const params = await props.params;
  if (!isLang(params.lang) || !isSafeSlug(params.slug)) notFound();
  const lang = params.lang;
  const d = getDictionary(lang).lessons;
  const result = await getLesson(params.slug);
  if (!result.ok && result.reason === 'not-found') notFound();
  if (!result.ok) return <p className="mt-6">{d.lessonUnavailable}</p>;

  const lesson = result.lesson;
  const paragraphs = lesson.body[lang].split('\n').filter(Boolean);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: lesson.title[lang],
    description: makeDescription(lesson.body[lang]),
    inLanguage: lang === 'bn' ? 'bn' : 'en',
    url: absUrl(lang, `/lessons/${params.slug}`),
    datePublished: lesson.publishedAt,
  };
  const breadcrumbs = breadcrumbData(lang, [
    { name: getDictionary(lang).brand, path: '' },
    { name: d.back, path: '/lessons' },
    { name: lesson.title[lang], path: `/lessons/${params.slug}` },
  ]);

  return (
    <article>
      <JsonLd data={[data, breadcrumbs]} />
      <p className="mb-4 text-sm"><Link href={`/${lang}/lessons`} className="link-azure">← {d.back}</Link></p>
      <PageHero eyebrow={getDictionary(lang).brand} title={lesson.title[lang]} lead={makeDescription(lesson.body[lang])} />
      {lesson.media?.type === 'image' && lesson.media.url ? (
        <img src={lesson.media.url} alt={lesson.title[lang]} loading="lazy" className="mt-4 w-full rounded-xl" />
      ) : null}
      {lesson.media?.type === 'video' && lesson.media.url ? (
        <video src={lesson.media.url} controls preload="metadata" className="mt-4 w-full rounded-xl" />
      ) : null}
      {lesson.media?.type === 'audio' && lesson.media.url ? (
        <audio src={lesson.media.url} controls preload="metadata" className="mt-4 w-full" />
      ) : null}
      <div className="mt-6">
        <AudioDramaPlayer
          title={lesson.title[lang]}
          content={lesson.body[lang]}
          vocabulary={lesson.vocabulary || []}
          lang={lang}
        />
      </div>
      {lesson.vocabulary?.length ? (
        <section className="surface-card mt-6 p-6 sm:p-8">
          <h2 className="section-heading text-xl">{d.vocabulary}</h2>
          <dl className="mt-3 space-y-2">
            {lesson.vocabulary.map((v) => (
              <div key={v.word} className="routine-tile p-3 text-sm">
                <dt className="font-semibold text-gold-soft">{v.word}</dt>
                <dd className="opacity-80">{v.meaning[lang]}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {lesson.quiz?.length ? (
        <section className="mt-8 space-y-4">
          <h2 className="section-heading text-2xl">{lang === 'bn' ? 'পাঠের কুইজ' : 'Lesson quiz'}</h2>
          {lesson.quiz.map((question, questionIndex) => (
            <article key={`${lesson.id}-quiz-${questionIndex}`} className="routine-tile p-4">
              <h3 className="font-semibold">{questionIndex + 1}. {question.question[lang]}</h3>
              <ol className="mt-3 list-inside list-[upper-alpha] space-y-2 text-sm opacity-90">
                {question.options.map((option, optionIndex) => (
                  <li key={`${lesson.id}-quiz-${questionIndex}-option-${optionIndex}`}>{option[lang]}</li>
                ))}
              </ol>
            </article>
          ))}
        </section>
      ) : null}
      <div className="surface-card mt-6 flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm font-semibold">{d.quizCta}</p>
        <Link href="/app" className="primary-button inline-flex shrink-0 bg-sapphire px-6 py-3 font-bold text-on-sapphire">/app</Link>
      </div>
    </article>
  );
}
