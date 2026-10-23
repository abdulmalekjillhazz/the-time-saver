/* global document, window */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('mobile header and home page at 360px', () => {
  test('the home page does not scroll sideways', async ({ page }) => {
    await page.goto('/en');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('the menu opens, Escape closes it, and focus returns to the button', async ({ page }) => {
    await page.goto('/en');
    const button = page.getByRole('button', { name: 'Menu' });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Lessons', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
  });

  test('audio drama practice is readable and accessible on a phone', async ({ page }) => {
    await page.goto('/en/lessons/the-energy-drip-discovery');
    await page.getByRole('button', { name: '🎙 Practice pronunciation' }).click();

    const practice = page.getByRole('region', { name: 'Practice speaking story lines' });
    await expect(practice.getByRole('progressbar', { name: 'Practice progress' })).toBeVisible();
    await expect(practice.getByText('Sentence 1', { exact: true })).toBeVisible();
    await expect(practice.getByText('0 of 3 tries')).toBeVisible();
    await expect(practice.getByRole('button', { name: '🔊 Listen to example' })).toBeVisible();

    const sentence = practice.locator('article > p').first();
    const fontSize = Number.parseFloat(
      await sentence.evaluate((element) => element.ownerDocument.defaultView.getComputedStyle(element).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(20);

    const readButton = practice.getByRole('button', { name: 'Read and check' });
    const buttonBox = await readButton.boundingBox();
    expect(buttonBox.height).toBeGreaterThanOrEqual(48);

    const results = await new AxeBuilder({ page }).include('section[aria-label="Practice speaking story lines"]').analyze();
    expect(results.violations).toEqual([]);
  });

  test('choosing a speaking situation keeps its player inline on mobile', async ({ page }) => {
    await page.goto('/app');
    await page.getByRole('button', { name: 'Learn to speak' }).click();

    const situation = page.getByRole('button', { name: /Meeting someone new/ });
    await situation.click();

    await expect(page.locator('#speaking-practice-panel')).toBeHidden();
    const start = page.getByRole('button', { name: '▶ Start' });
    await expect(start).toBeVisible();
    await start.click();
    await expect(page.getByRole('region', { name: 'Learn English by Story' })).toBeVisible();
    await expect(page.getByRole('button', { name: '⏸ Pause' })).toBeVisible();
  });

  test('tapping a story word speaks it slowly with its conversation context using the Google voice', async ({ page }) => {
    await page.addInitScript(() => {
      window.__spokenWords = [];
      const googleVoice = { name: 'Google US English', lang: 'en-US' };
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          cancel() {},
          getVoices() { return [googleVoice]; },
          speak(utterance) {
            window.__spokenWords.push({
              text: utterance.text,
              rate: utterance.rate,
              voice: utterance.voice?.name,
            });
          },
        },
      });
      window.SpeechSynthesisUtterance = class {
        constructor(text) { this.text = text; }
      };
    });
    await page.goto('/en/lessons/the-energy-drip-discovery');
    const story = page.getByRole('list', { name: 'Story dialogue' });
    await story.getByRole('listitem').first().getByRole('button', { name: 'The', exact: true }).click();

    const speech = await page.evaluate(() => window.__spokenWords[0]);
    expect(speech.text).toContain('the. In this conversation:');
    expect(speech.text).toContain('kitchen table');
    expect(speech.rate).toBe(0.78);
    expect(speech.voice).toBe('Google US English');
  });

  test('audio drama controls reflow for phone and desktop layouts', async ({ page }) => {
    await page.goto('/en/lessons/the-energy-drip-discovery');
    const player = page.getByRole('region', { name: 'Learn English by Story' });
    const toolbar = player.locator('div.sticky').first();
    const storyStage = player.getByRole('list', { name: 'Story dialogue' });
    const storyCard = storyStage.getByRole('listitem').first();

    await expect(toolbar).toHaveCSS('display', 'grid');
    await expect(storyStage).toHaveCSS('align-content', 'center');
    await expect(storyCard).toBeVisible();
    const stageBox = await storyStage.boundingBox();
    const cardBox = await storyCard.boundingBox();
    expect(Math.abs((cardBox.y + cardBox.height / 2) - (stageBox.y + stageBox.height / 2))).toBeLessThanOrEqual(32);
    let overflow = await player.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(toolbar).toHaveCSS('display', 'flex');
    overflow = await player.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('all Android app links point to the Cloudinary-backed production APK download', async ({ page }) => {
    const downloadUrl = '/downloads/android';
    await page.goto('/en');
    await expect(page.locator('#main').getByRole('link', { name: 'Download Android app' })).toHaveAttribute('href', downloadUrl);
    await expect(page.getByRole('navigation', { name: 'Resources' }).getByRole('link', { name: 'Download Android app' })).toHaveAttribute('href', downloadUrl);
    const apkResponse = await page.request.head(new URL(downloadUrl, page.url()).href);
    expect(apkResponse.ok()).toBeTruthy();
    expect(apkResponse.headers()['content-type']).toContain('application/vnd.android.package-archive');
    expect(apkResponse.headers()['content-disposition']).toContain('Smart-Routine-Android-v1.4.apk');

    await page.getByRole('button', { name: 'Menu' }).click();
    const navigationLinks = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Download Android app' });
    await expect(navigationLinks).toHaveAttribute('href', downloadUrl);
  });

  test('the home page has no axe violations', async ({ page }) => {
    await page.goto('/en');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
