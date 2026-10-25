'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { apiRequest } from '../lib/apiClient.js';

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';

export function MobileGoogleLogin({ lang }) {
  const buttonRef = useRef(null);
  const [clientId, setClientId] = useState('');
  const [scriptReady, setScriptReady] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const isBangla = lang === 'bn';

  useEffect(() => {
    apiRequest('/api/auth/google/config')
      .then((config) => {
        if (typeof config.clientId !== 'string' || !config.clientId) {
          throw new Error('Google sign-in is not configured.');
        }
        setClientId(config.clientId);
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    const googleAccounts = globalThis.google?.accounts?.id;
    if (!scriptReady || !clientId || !googleAccounts || !buttonRef.current) return;
    googleAccounts.initialize({
      client_id: clientId,
      callback: async ({ credential }) => {
        if (!credential) {
          setError(isBangla ? 'Google থেকে পরিচয় যাচাই করা যায়নি।' : 'Google did not return a sign-in credential.');
          return;
        }
        setStatus(isBangla ? 'সাইন ইন সম্পন্ন হচ্ছে…' : 'Completing sign-in…');
        setError('');
        try {
          const handoff = await apiRequest('/api/auth/google/handoff', {
            method: 'POST',
            body: {
              credential,
              locale: lang,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka',
            },
            locale: lang,
          });
          if (typeof handoff.code !== 'string') throw new Error('The secure sign-in handoff was invalid.');
          setStatus(isBangla ? 'অ্যাপে ফিরিয়ে নেওয়া হচ্ছে…' : 'Returning to the app…');
          window.location.assign(`smartroutine://auth/callback?code=${encodeURIComponent(handoff.code)}`);
        } catch (requestError) {
          setStatus('');
          setError(requestError.message);
        }
      },
    });
    googleAccounts.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      locale: lang,
      width: Math.min(380, Math.max(200, window.innerWidth - 48)),
    });
  }, [clientId, isBangla, lang, scriptReady]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <Script src={GOOGLE_IDENTITY_SCRIPT} strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      <section className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{isBangla ? 'Smart Routine-এ সাইন ইন' : 'Sign in to Smart Routine'}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {isBangla
              ? 'Google দিয়ে সাইন ইন করলে আপনাকে নিরাপদে অ্যাপে ফিরিয়ে নেওয়া হবে।'
              : 'After Google sign-in, you will be securely returned to the app.'}
          </p>
        </div>
        <div ref={buttonRef} className="flex min-h-12 justify-center" />
        {status ? <p role="status" className="text-center text-sm text-emerald-300">{status}</p> : null}
        {error ? <p role="alert" className="rounded-xl bg-rose-950/70 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
      </section>
    </main>
  );
}
