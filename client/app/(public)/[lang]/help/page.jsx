import { notFound } from 'next/navigation';
import { isLang, pageMetadata, titleWith } from '../../../../lib/seo.js';
import { getDictionary } from '../../../../i18n/dictionaries.js';
import { BreadcrumbJsonLd } from '../../../../components/JsonLd.jsx';
import { PageHero } from '../../../../components/PageHero.jsx';

export async function generateMetadata(props) {
  const params = await props.params;
  if (!isLang(params.lang)) return {};
  const d = getDictionary(params.lang).help;
  return pageMetadata({ lang: params.lang, path: '/help', title: titleWith(d.title), description: d.description });
}

export default async function Page(props) {
  const params = await props.params;
  if (!isLang(params.lang)) notFound();
  const d = getDictionary(params.lang).help;
  return (
    <>
      <BreadcrumbJsonLd lang={params.lang} items={[
        { name: getDictionary(params.lang).brand, path: '' },
        { name: d.h1, path: '/help' },
      ]} />
      <PageHero eyebrow={getDictionary(params.lang).brand} title={d.h1} lead={d.description} />
      <div className="surface-card prose-brand mt-6 p-6 sm:p-8">
        {d.body.map((p, i) => <p key={i}>{p}</p>)}
        {process.env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
          <p className="mt-6">
            <a className="link-azure" href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL}`}>{process.env.NEXT_PUBLIC_SUPPORT_EMAIL}</a>
          </p>
        ) : null}
      </div>
    </>
  );
}
