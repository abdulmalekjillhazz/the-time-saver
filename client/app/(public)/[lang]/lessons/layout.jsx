import { isLang, BRAND, absUrl } from '../../../../lib/seo.js';
import { getDictionary } from '../../../../i18n/dictionaries.js';
import { JsonLd } from '../../../../components/JsonLd.jsx';

export default async function LessonsLayout(props) {
  const params = await props.params;
  const { children } = props;
  const lang = isLang(params?.lang) ? params.lang : 'bn';
  const d = getDictionary(lang).lessons;

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: d.title,
    description: d.description,
    url: absUrl(lang, '/lessons'),
    inLanguage: lang === 'bn' ? 'bn-BD' : 'en-US',
    isPartOf: {
      '@type': 'WebSite',
      name: BRAND,
      url: absUrl(lang, ''),
    },
  };

  return (
    <>
      <JsonLd data={collectionSchema} />
      {children}
    </>
  );
}
