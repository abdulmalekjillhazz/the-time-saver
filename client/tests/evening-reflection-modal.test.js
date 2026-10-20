import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EveningReflectionModal } from '../components/EveningReflectionModal.jsx';

describe('evening reflection modal', () => {
  it('does not promise XP on every save because edits do not award XP again', () => {
    const markup = renderToStaticMarkup(createElement(EveningReflectionModal, {
      lang: 'en',
      onClose() {},
    }));

    expect(markup).toContain('Save Reflection');
    expect(markup).not.toContain('+30 XP');
  });

  it('uses localized save copy in Bengali', () => {
    const markup = renderToStaticMarkup(createElement(EveningReflectionModal, {
      lang: 'bn',
      onClose() {},
    }));

    expect(markup).toContain('সংরক্ষণ করুন');
    expect(markup).not.toContain('+৩০ XP');
  });
});
