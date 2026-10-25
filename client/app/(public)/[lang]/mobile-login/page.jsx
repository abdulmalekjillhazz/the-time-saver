import { notFound } from 'next/navigation';
import { isLang } from '../../../../lib/seo.js';
import { MobileGoogleLogin } from '../../../../components/MobileGoogleLogin.jsx';

export default async function MobileLoginPage(props) {
  const params = await props.params;
  if (!isLang(params.lang)) notFound();
  return <MobileGoogleLogin lang={params.lang} />;
}
