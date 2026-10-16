import { ImageResponse } from 'next/og';
import { BRAND, isLang } from '../../../../lib/seo.js';

export const revalidate = 86400;

export async function GET(_request, { params }) {
  const routeParams = await params;
  if (!isLang(routeParams.lang)) return new Response('Not found', { status: 404 });
  const isBengali = routeParams.lang === 'bn';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(125deg, #03140c 0%, #062719 58%, #020805 100%)',
          color: '#f0fdf4',
          fontFamily: 'Arial, sans-serif',
          padding: '76px 88px',
        }}
      >
        <div style={{ display: 'flex', width: '65%', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, color: '#f2c14e', fontSize: 26, fontWeight: 700 }}>
            <div style={{ display: 'flex', width: 58, height: 58, alignItems: 'center', justifyContent: 'center', border: '2px solid #f2c14e', borderRadius: 16, background: '#000', color: '#fce9b0', fontSize: 25 }}>
              SR
            </div>
            {BRAND}
          </div>
          <div style={{ display: 'flex', marginTop: 58, fontSize: 58, fontWeight: 750, lineHeight: 1.1, letterSpacing: -1 }}>
            {isBengali ? 'আপনার দিনের জন্য' : 'Make room for'}
          </div>
          <div style={{ display: 'flex', marginTop: 8, color: '#f2c14e', fontSize: 58, fontWeight: 750, lineHeight: 1.1, letterSpacing: -1 }}>
            {isBengali ? 'গড়ুন ভালো অভ্যাস' : 'better routines'}
          </div>
          <div style={{ display: 'flex', marginTop: 30, color: '#c7d8cc', fontSize: 25 }}>
            {isBengali ? 'রুটিন · ফোকাস · অগ্রগতি' : 'Daily routines · Focus · Steady progress'}
          </div>
        </div>
        <div style={{ display: 'flex', width: 270, height: 310, flexDirection: 'column', justifyContent: 'center', gap: 22, border: '1px solid #5f805f', borderRadius: 26, background: 'rgba(0,0,0,0.58)', padding: 26 }}>
          {['07:00  ·  Routine', '09:30  ·  Focus', '11:00  ·  Progress'].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', color: '#f0fdf4', fontSize: 20 }}>
              <span style={{ display: 'flex', width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: 14, border: '1px solid #4ade80', borderRadius: 99, color: '#4ade80' }}>✓</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
