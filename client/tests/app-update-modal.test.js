import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppUpdateDialogView } from '../components/AppUpdateModal.jsx';

describe('AppUpdateModal dialog view', () => {
  it('renders an update banner in Bengali when update info is provided', () => {
    const markup = renderToStaticMarkup(createElement(AppUpdateDialogView, {
      updateInfo: {
        latestVersion: '1.15',
        latestBuild: 15,
        downloadUrl: '/downloads/android',
        forceUpdate: false,
        releaseNotes: {
          bn: 'নতুন ডুওলিঙ্গো স্টাইল প্র্যাকটিস',
          en: 'New Duolingo style practice',
        },
      },
      currentVersion: '1.14',
      isBn: true,
      onUpdate: () => {},
      onDismiss: () => {},
    }));

    expect(markup).toContain('নতুন আপডেট উপলব্ধ!');
    expect(markup).toContain('v1.15');
    expect(markup).toContain('বর্তমান v1.14');
    expect(markup).toContain('নতুন ডুওলিঙ্গো স্টাইল প্র্যাকটিস');
    expect(markup).toContain('এখনই আপডেট করুন (APK)');
    expect(markup).toContain('পরে');
  });

  it('renders in English when isBn is false', () => {
    const markup = renderToStaticMarkup(createElement(AppUpdateDialogView, {
      updateInfo: {
        latestVersion: '1.15',
        latestBuild: 15,
        downloadUrl: '/downloads/android',
        forceUpdate: false,
        releaseNotes: {
          bn: 'নতুন ডুওলিঙ্গো স্টাইল প্র্যাকটিস',
          en: 'New Duolingo style practice',
        },
      },
      currentVersion: '1.14',
      isBn: false,
      onUpdate: () => {},
      onDismiss: () => {},
    }));

    expect(markup).toContain('New Update Available!');
    expect(markup).toContain('v1.15');
    expect(markup).toContain('New Duolingo style practice');
    expect(markup).toContain('Update Now (APK)');
    expect(markup).toContain('Later');
  });

  it('renders null when updateInfo is null', () => {
    const markup = renderToStaticMarkup(createElement(AppUpdateDialogView, {
      updateInfo: null,
      currentVersion: null,
      isBn: true,
      onUpdate: () => {},
      onDismiss: () => {},
    }));

    expect(markup).toBe('');
  });
});

