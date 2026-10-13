import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileAvatar, ProfileAvatarPicker } from '../components/ProfileAvatar.jsx';

describe('profile avatar picker', () => {
  it('renders all six built-in choices and marks the selected avatar', () => {
    const markup = renderToStaticMarkup(createElement(ProfileAvatarPicker, {
      value: 'hijab',
      onChange: vi.fn(),
      lang: 'en',
    }));

    expect(markup.match(/aria-pressed="(?:true|false)"/g)).toHaveLength(6);
    expect(markup).toContain('aria-label="Teal hijab"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('Choose an avatar');
  });

  it('renders the selected avatar as a round lightweight SVG', () => {
    const markup = renderToStaticMarkup(createElement(ProfileAvatar, { avatarId: 'wave', size: 'md' }));

    expect(markup).toContain('<svg');
    expect(markup).toContain('rounded-full');
    expect(markup).toContain('viewBox="0 0 100 100"');
  });
});
