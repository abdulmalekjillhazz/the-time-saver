'use client';

import React, { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { isAndroidNativeApp } from '../lib/nativeAlarm.js';
import { ANDROID_APK_DOWNLOAD_URL } from '../lib/downloads.js';

const DISMISSED_UPDATE_KEY = 'smart_routine_dismissed_update';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export function AppUpdateDialogView({
  updateInfo,
  currentVersion,
  isBn,
  onUpdate,
  onDismiss,
}) {
  if (!updateInfo) return null;

  const releaseNote = isBn
    ? (updateInfo.releaseNotes?.bn || updateInfo.releaseNotes?.en || '')
    : (updateInfo.releaseNotes?.en || updateInfo.releaseNotes?.bn || '');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-modal-title"
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center bg-black/60 p-4 backdrop-blur-sm enter-up"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gold/40 bg-paper p-5 sm:p-6 text-ink shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border-2 border-gold/40 bg-gold/15 text-2xl shadow-inner" aria-hidden="true">
            🚀
          </span>
          <div>
            <h3 id="app-update-modal-title" className="text-base sm:text-lg font-black text-ink">
              {isBn ? 'নতুন আপডেট উপলব্ধ!' : 'New Update Available!'}
            </h3>
            <p className="text-xs font-semibold text-gold-soft">
              {isBn ? `সংস্করণ v${updateInfo.latestVersion}` : `Version v${updateInfo.latestVersion}`}
              {currentVersion ? ` (বর্তমান v${currentVersion})` : ''}
            </p>
          </div>
        </div>

        {releaseNote ? (
          <div className="rounded-2xl border border-sapphire/20 bg-sapphire/10 p-3.5 text-xs font-medium leading-relaxed text-ink/90">
            <p className="font-bold text-sapphire mb-1">
              {isBn ? '✨ এই আপডেটের নতুন বৈশিষ্ট্য:' : '✨ What’s New:'}
            </p>
            <p>{releaseNote}</p>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={onUpdate}
            className="primary-button flex-1 min-h-[46px] justify-center items-center gap-2 rounded-xl bg-sapphire px-4 py-2 text-sm font-extrabold text-on-sapphire shadow-md hover:bg-sapphire/90 active:scale-95 transition-all"
          >
            <span>⬇️</span>
            <span>{isBn ? 'এখনই আপডেট করুন (APK)' : 'Update Now (APK)'}</span>
          </button>
          {!updateInfo.forceUpdate ? (
            <button
              type="button"
              onClick={onDismiss}
              className="secondary-button min-h-[44px] justify-center items-center rounded-xl px-4 py-2 text-xs sm:text-sm font-bold text-ink/70 hover:text-ink hover:bg-ink/5 transition-all"
            >
              {isBn ? 'পরে' : 'Later'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AppUpdateModal({ lang = 'bn' }) {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [currentVersion, setCurrentVersion] = useState(null);
  const isBn = lang === 'bn';

  useEffect(() => {
    let cancelled = false;

    async function checkAppVersion() {
      try {
        const isNative = isAndroidNativeApp() || Capacitor.isNativePlatform();
        let installedBuild = 0;
        let installedVersion = '';

        if (isNative) {
          try {
            const info = await App.getInfo();
            installedBuild = parseInt(info?.build, 10) || 0;
            installedVersion = info?.version || '';
          } catch {
            // Not running in native environment or getInfo failed
          }
        }

        const res = await fetch('/api/app/version', {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;

        const data = await res.json();
        if (cancelled || !data?.ok) return;

        const remoteBuild = parseInt(data.latestBuild, 10) || 0;
        const hasNewerBuild = remoteBuild > installedBuild && installedBuild > 0;
        const hasNewerVersion = Boolean(
          data.latestVersion && installedVersion && data.latestVersion !== installedVersion
        );

        const isUpdateAvailable = hasNewerBuild || (isNative && hasNewerVersion);

        if (!isUpdateAvailable && isNative) return;

        // If not forced, check dismissal timestamp
        if (!data.forceUpdate) {
          try {
            const stored = localStorage.getItem(DISMISSED_UPDATE_KEY);
            if (stored) {
              const { build, timestamp } = JSON.parse(stored);
              if (build === remoteBuild && Date.now() - timestamp < SNOOZE_DURATION_MS) {
                return;
              }
            }
          } catch {}
        }

        if (isUpdateAvailable) {
          setCurrentVersion(installedVersion);
          setUpdateInfo(data);
        }
      } catch {
        // Silently skip if network check fails
      }
    }

    void checkAppVersion();
    return () => { cancelled = true; };
  }, []);

  if (!updateInfo) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSED_UPDATE_KEY, JSON.stringify({
        build: updateInfo.latestBuild,
        timestamp: Date.now(),
      }));
    } catch {}
    setUpdateInfo(null);
  };

  const handleUpdate = () => {
    const targetUrl = updateInfo.downloadUrl || ANDROID_APK_DOWNLOAD_URL;
    if (typeof window !== 'undefined') {
      window.open(targetUrl, '_system');
    }
    handleDismiss();
  };

  return (
    <AppUpdateDialogView
      updateInfo={updateInfo}
      currentVersion={currentVersion}
      isBn={isBn}
      onUpdate={handleUpdate}
      onDismiss={handleDismiss}
    />
  );
}

