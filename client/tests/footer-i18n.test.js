import { describe, it, expect } from 'vitest';
import { DICTIONARIES } from '../i18n/dictionaries.js';

const FOOTER_KEYS = ['note', 'label', 'privacy', 'terms', 'help'];
const NAV_KEYS = ['label', 'home', 'lessons', 'about', 'help', 'app', 'downloadAndroid', 'menu', 'close'];

describe('footer and navigation copy', () => {
  it('every footer key exists and is not empty in both languages', () => {
    for (const [lang, dict] of Object.entries(DICTIONARIES)) {
      for (const key of FOOTER_KEYS) {
        expect(dict.footer[key], `${lang} footer.${key}`).toBeTruthy();
      }
    }
  });

  it('every navigation key exists and is not empty in both languages', () => {
    for (const [lang, dict] of Object.entries(DICTIONARIES)) {
      for (const key of NAV_KEYS) {
        expect(dict.nav[key], `${lang} nav.${key}`).toBeTruthy();
      }
    }
  });

  it('provides Android download copy and a sideloading notice in both languages', () => {
    for (const [lang, dict] of Object.entries(DICTIONARIES)) {
      expect(dict.home.ctaAndroid, `${lang} home.ctaAndroid`).toBeTruthy();
      expect(dict.home.androidDownloadNote, `${lang} home.androidDownloadNote`).toBeTruthy();
    }
  });

  it('does not expose internal copy-review notes in the public footer', () => {
    expect(DICTIONARIES.bn.footer).not.toHaveProperty('draftNotice');
    expect(DICTIONARIES.en.footer).not.toHaveProperty('draftNotice');
  });

  it('both language dictionaries are approved for public display', () => {
    expect(DICTIONARIES.en.draft).toBe(false);
    expect(DICTIONARIES.bn.draft).toBe(false);
  });
});
