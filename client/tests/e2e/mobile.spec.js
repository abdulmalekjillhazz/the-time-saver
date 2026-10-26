import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('mobile header and home page at 360px', () => {
  test.use({ serviceWorkers: 'block' });

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

  test('audio drama practice fits one simple, accessible phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.addInitScript(() => {
      window.__spokenPracticeLines = [];
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          cancel() {},
          getVoices() { return []; },
          speak(utterance) { window.__spokenPracticeLines.push(utterance.text); },
        },
      });
      window.SpeechSynthesisUtterance = class {
        constructor(text) { this.text = text; }
      };
    });
    await page.route('**/api/word-meaning**', (route) => route.fulfill({
      json: { ok: true, meaning: 'A sample meaning for a practice word.' },
    }));
    await page.goto('/en/lessons/the-energy-drip-discovery');
    await page.waitForLoadState('networkidle');
    const openPracticeButton = page.getByRole('button', { name: '🎙 Practice pronunciation' });
    await openPracticeButton.click();
    await expect(page.getByRole('button', { name: 'Exit practice' })).toBeVisible();

    const practice = page.getByRole('region', { name: 'Practice speaking story lines' });
    await expect(practice).toBeVisible();
    await expect(practice.getByRole('heading', { name: 'Practice speaking story lines' })).toBeAttached();
    await expect(practice.getByText('Sentence difficulty adapts to your progress')).toHaveCount(0);
    const sentence = practice.locator('.speech-practice-sentence');
    const firstWord = sentence.getByRole('button').first();
    const firstWordText = (await firstWord.innerText()).replace(/[^a-z0-9']/gi, '').toLowerCase();
    await firstWord.click();
    await expect.poll(() => page.evaluate(() => window.__spokenPracticeLines)).toHaveLength(1);
    expect(await page.evaluate(() => window.__spokenPracticeLines[0])).toBe(firstWordText);
    const meaningPanel = page.getByRole('status').filter({ hasText: 'A sample meaning for a practice word.' });
    await expect(meaningPanel).toBeVisible();
    await expect(meaningPanel).toBeInViewport();
    await page.getByRole('button', { name: 'Close word meaning' }).click();
    await expect(meaningPanel).toBeHidden();
    await expect(practice.getByRole('progressbar', { name: 'Practice progress' })).toBeVisible();
    await expect(practice.getByText('1 / 13', { exact: true })).toBeVisible();
    await expect(practice.getByText('0 of 3 tries')).toHaveCount(0);

    const sentenceBox = await sentence.boundingBox();
    const fontSize = Number.parseFloat(
      await sentence.evaluate((element) => element.ownerDocument.defaultView.getComputedStyle(element).fontSize),
    );
    expect(fontSize).toBeGreaterThanOrEqual(20);

    const microphoneButton = practice.getByRole('button', { name: 'Read and check' });
    await expect(microphoneButton.locator('svg')).toBeVisible();
    const buttonBox = await microphoneButton.boundingBox();
    expect(buttonBox.height).toBeGreaterThanOrEqual(48);
    expect(buttonBox.width).toBeGreaterThanOrEqual(48);
    expect(buttonBox.y).toBeGreaterThan(sentenceBox.y);
    const practiceBox = await practice.boundingBox();
    expect(Math.abs((buttonBox.x + buttonBox.width / 2) - (practiceBox.x + practiceBox.width / 2))).toBeLessThanOrEqual(2);
    const skipButton = practice.getByRole('button', { name: 'Skip to next sentence' });
    await expect(skipButton).toBeInViewport();
    expect(Number.parseFloat(await skipButton.evaluate((element) => element.ownerDocument.defaultView.getComputedStyle(element).fontSize))).toBeLessThanOrEqual(12);
    expect((await practice.boundingBox()).height).toBeLessThanOrEqual(640);

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 360, height: 640 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const root = document.querySelector('.audio-drama-player');
        const panel = document.querySelector('.speech-practice-panel');
        const microphone = document.querySelector('.speech-practice-speak');
        const nextButton = document.querySelector('.speech-practice-card button.mx-auto');
        const bounds = (element) => element.getBoundingClientRect();
        const micBounds = bounds(microphone);
        return {
          rootHasHorizontalOverflow: root.scrollWidth > root.clientWidth,
          rootHasVerticalOverflow: root.scrollHeight > root.clientHeight,
          micCenterOffset: Math.abs((micBounds.left + micBounds.width / 2) - (window.innerWidth / 2)),
          panelBottom: bounds(panel).bottom,
          nextButtonBottom: bounds(nextButton).bottom,
        };
      });
      expect(layout.rootHasHorizontalOverflow, `${viewport.width}x${viewport.height} horizontal overflow`).toBe(false);
      expect(layout.rootHasVerticalOverflow, `${viewport.width}x${viewport.height} vertical overflow`).toBe(false);
      expect(layout.micCenterOffset, `${viewport.width}x${viewport.height} microphone alignment`).toBeLessThanOrEqual(2);
      expect(layout.panelBottom, `${viewport.width}x${viewport.height} practice panel clipping`).toBeLessThanOrEqual(viewport.height);
      expect(layout.nextButtonBottom, `${viewport.width}x${viewport.height} next sentence visibility`).toBeLessThanOrEqual(viewport.height);
    }

    const results = await new AxeBuilder({ page }).include('section[aria-label="Practice speaking story lines"]').analyze();
    expect(results.violations).toEqual([]);
  });

  test('plays the voice briefing after staying on Today for four seconds', async ({ page }) => {
    await page.addInitScript(() => {
      window.__voiceBriefingStarted = false;
      window.AudioContext = class {
        constructor() {
          this.state = 'running';
          this.currentTime = 0;
          this.destination = {};
        }
        resume() { return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
        decodeAudioData() { return Promise.resolve({}); }
        createBufferSource() {
          return {
            connect() {},
            start() { window.__voiceBriefingStarted = true; },
            stop() {},
          };
        }
      };
    });
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const responses = {
        '/api/me': {
          user: {
            id: 'today-briefing-test',
            displayName: 'Ayesha',
            email: 'ayesha@example.com',
            timezone: 'Asia/Dhaka',
            locale: 'en',
          },
        },
        '/api/auth/google/config': { clientId: '' },
        '/api/auth/csrf': { csrfToken: 'today-briefing-test-token' },
        '/api/routines': { routines: [] },
        '/api/lessons': { lessons: [] },
        '/api/lessons/today': { dailyLesson: null, quiz: null },
        '/api/assistant/predict-hybrid': { predictions: [] },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responses[pathname] || {}),
      });
    });

    await page.goto('/app');
    await expect(page.getByRole('button', { name: 'Voice briefing' })).toBeVisible();
    const briefing = page.getByRole('dialog', { name: /Your Personal Voice Briefing/ });
    await expect(briefing).toBeVisible({ timeout: 8000 });
    await expect.poll(() => page.evaluate(() => window.__voiceBriefingStarted)).toBe(true);
  });

  test('requests microphone permission before starting browser speech recognition', async ({ page }) => {
    await page.addInitScript(() => {
      window.__micPermissionRequested = false;
      window.__recognitionStarted = false;
      navigator.mediaDevices.getUserMedia = async () => {
        window.__micPermissionRequested = true;
        return { getTracks: () => [{ stop() {} }] };
      };
      window.SpeechRecognition = class {
        start() {
          window.__recognitionStarted = true;
          this.onresult?.({ results: [[{ transcript: 'Maybe it did I feel so sleepy' }]] });
          this.onend?.();
        }
        stop() {}
        abort() {}
      };
    });
    await page.goto('/en/lessons/the-energy-drip-discovery');
    await page.getByRole('button', { name: '🎙 Practice pronunciation' }).click();
    const practice = page.getByRole('region', { name: 'Practice speaking story lines' });
    await practice.getByRole('button', { name: 'Read and check' }).click();
    await expect(page.getByRole('dialog', { name: 'Microphone permission' })).toBeVisible();
    await page.getByRole('button', { name: 'Allow and start' }).click();

    await expect.poll(() => page.evaluate(() => window.__micPermissionRequested)).toBe(true);
    await expect.poll(() => page.evaluate(() => window.__recognitionStarted)).toBe(true);
    await expect(practice.getByText(/Word match:/)).toBeVisible();
  });

  test('scores the complete pronunciation session and submits it to the leaderboard', async ({ page }) => {
    let submittedScore;
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = async () => ({
        getTracks: () => [{ stop() {} }],
      });
      window.SpeechRecognition = class {
        start() {
          const transcript = document.querySelector('.speech-practice-sentence')?.innerText || '';
          this.onresult?.({ results: [[{ transcript }]] });
          this.onend?.();
        }
        stop() {}
        abort() {}
      };
    });
    await page.route('**/api/auth/csrf', (route) => route.fulfill({
      json: { csrfToken: 'practice-test-token' },
    }));
    await page.route('**/api/gamification/pronunciation', async (route) => {
      submittedScore = route.request().postDataJSON();
      await route.fulfill({
        json: { bestAccuracy: submittedScore.accuracy, earnedPoints: 50, awardedBadges: [] },
      });
    });
    await page.route('**/api/word-meaning**', (route) => route.fulfill({
      json: { ok: true, meaning: 'A meaning on this device.' },
    }));
    await page.goto('/en/lessons/the-energy-drip-discovery');
    await page.getByRole('button', { name: '📄 Show full story' }).click();
    await page.getByRole('button', { name: '🎙 Practice pronunciation' }).click();
    const practice = page.getByRole('region', { name: 'Practice speaking story lines' });
    const stepCount = Number((await practice.locator('.speech-practice-progress-row > span').first().innerText()).split(' / ')[1]);
    const firstPracticeSentence = await practice.locator('.speech-practice-sentence').innerText();
    expect(firstPracticeSentence).not.toMatch(/^The story begins\./i);

    for (let index = 0; index < stepCount; index += 1) {
      const currentSentence = await practice.locator('.speech-practice-sentence').innerText();
      await expect(practice.getByRole('img', { name: 'Character expression' })).toBeVisible();
      if (index === 0) {
        await practice.locator('.speech-practice-sentence').getByRole('button').first().click();
        await expect(page.getByRole('status').filter({ hasText: 'A meaning on this device.' })).toBeVisible();
        await page.getByRole('button', { name: 'Close word meaning' }).click();
      }
      await practice.getByRole('button', { name: 'Read and check' }).click();
      if (index === 0) {
        await page.getByRole('dialog', { name: 'Microphone permission' }).getByRole('button', { name: 'Allow and start' }).click();
      }
      await expect(practice.getByText('Correct', { exact: true })).toBeVisible();
      if (index < stepCount - 1) {
        await expect(practice.locator('.speech-practice-sentence')).not.toHaveText(currentSentence, { timeout: 2500 });
        await expect(practice.locator('.speech-practice-progress-row > span').first()).toHaveText(`${index + 2} / ${stepCount}`);
      }
    }

    await expect(practice.getByText('Pronunciation accuracy: 100%', { exact: true })).toBeVisible();
    await expect(practice.getByText('Nothing left to improve.', { exact: true })).toBeVisible();
    await expect.poll(() => submittedScore).toEqual({
      slug: 'the-energy-drip-discovery',
      accuracy: 100,
    });
    await expect(practice.getByText('Your best leaderboard score is 100%; 50 points added.', { exact: true })).toBeVisible();
  });

  test('choosing a speaking situation keeps its player inline on mobile', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const responses = {
        '/api/me': {
          user: {
            id: 'speaking-situation-test',
            displayName: 'Ayesha',
            email: 'ayesha@example.com',
            timezone: 'Asia/Dhaka',
            locale: 'en',
          },
        },
        '/api/auth/google/config': { clientId: '' },
        '/api/routines': { routines: [] },
        '/api/lessons': { lessons: [] },
        '/api/lessons/today': { dailyLesson: null, quiz: null },
        '/api/assistant/predict-hybrid': { predictions: [] },
        '/api/auth/csrf': { csrfToken: 'speaking-situation-test-token' },
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responses[pathname] || {}),
      });
    });
    await page.goto('/app');
    const offlinePrompt = page.getByRole('dialog', { name: /অফলাইনে পড়ার জন্য গল্প/ });
    await expect(offlinePrompt).toBeVisible();
    await offlinePrompt.getByRole('button', { name: 'এখন নয়' }).click();
    const briefing = page.getByRole('dialog', { name: /Your Personal Voice Briefing/ });
    await expect(briefing).toBeVisible({ timeout: 8000 });
    await briefing.getByRole('button', { name: 'Close' }).first().click();
    await page.getByRole('button', { name: 'Learn to speak' }).click();

    const situation = page.getByRole('button', { name: /Meeting someone new/ });
    await situation.click();

    await expect(page.locator('#speaking-practice-panel')).toBeHidden();
    const start = page.getByRole('button', { name: 'Start', exact: true });
    await expect(start).toBeVisible();
    await start.click();
    await expect(page.getByRole('region', { name: 'Practice speaking story lines' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Read and check' })).toBeVisible();
  });

  test('speaking a tapped story word includes its conversation context', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
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
    await page.route('**/api/word-meaning**', (route) => route.fulfill({
      json: { ok: true, meaning: 'A sample meaning for a tapped word.' },
    }));
    await page.goto('/en/lessons/the-energy-drip-discovery');
    const story = page.getByRole('list', { name: 'Story dialogue' });
    await story.getByRole('listitem').first().getByRole('button', { name: 'The', exact: true }).click();

    const meaningPanel = page.getByRole('status').filter({ hasText: 'A sample meaning for a tapped word.' });
    await expect(meaningPanel).toBeVisible();
    await expect(meaningPanel).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Close word meaning' })).toBeVisible();
    await page.getByRole('button', { name: 'Hear pronunciation: The' }).click();
    await page.getByRole('button', { name: 'Close word meaning' }).click();
    await expect(meaningPanel).toBeHidden();

    const speech = await page.evaluate(() => window.__spokenWords[0]);
    expect(speech.text).toContain('the. In this conversation:');
    expect(speech.text).toContain('kitchen table');
    expect(speech.rate).toBe(0.82);
    expect(speech.voice).toBe('Google US English');
  });

  test('audio drama controls reflow for phone and desktop layouts', async ({ page }) => {
    await page.goto('/en/lessons/the-energy-drip-discovery');
    const player = page.getByRole('region', { name: 'Learn English by Story' });
    const toolbar = player.locator('.audio-drama-toolbar');
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

  test('all Android app links point to the latest production APK download', async ({ page }) => {
    const downloadUrl = '/downloads/android';
    const apkUrl = '/downloads/smart-routine-android-v1.15.apk';
    await page.goto('/en');
    await expect(page.locator('#main').getByRole('link', { name: 'Download Android app (v1.15)' })).toHaveAttribute('href', downloadUrl);
    await expect(page.getByRole('navigation', { name: 'Resources' }).getByRole('link', { name: 'Download Android app (v1.15)' })).toHaveAttribute('href', downloadUrl);
    const redirectResponse = await page.request.head(new URL(downloadUrl, page.url()).href, { maxRedirects: 0 });
    expect(redirectResponse.status()).toBe(302);
    expect(new URL(redirectResponse.headers().location).pathname).toBe(apkUrl);
    const apkResponse = await page.request.head(new URL(apkUrl, page.url()).href);
    expect(apkResponse.ok()).toBeTruthy();
    expect(apkResponse.headers()['content-type']).toContain('application/vnd.android.package-archive');
    expect(Number(apkResponse.headers()['content-length'])).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Menu' }).click();
    const navigationLinks = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Download Android app (v1.15)' });
    await expect(navigationLinks).toHaveAttribute('href', downloadUrl);

    await page.goto('/bn');
    await expect(page.locator('#main').getByRole('link', { name: 'অ্যান্ড্রয়েড অ্যাপ ডাউনলোড (v1.15)' })).toHaveAttribute('href', downloadUrl);
  });

  test('the home page has no axe violations', async ({ page }) => {
    await page.goto('/en');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
