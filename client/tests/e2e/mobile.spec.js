/* global document */
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

  test('all Android test app links point to the published APK', async ({ page }) => {
    const downloadUrl = 'https://github.com/abdulmalekjillhazz/the-time-saver/releases/download/android-v1.3-build4-debug-f5eea27/Smart-Routine-v1.3-build4-debug.apk';
    await page.goto('/en');
    await expect(page.locator('#main').getByRole('link', { name: 'Download Android test app' })).toHaveAttribute('href', downloadUrl);
    await expect(page.getByRole('navigation', { name: 'Resources' }).getByRole('link', { name: 'Download Android test app' })).toHaveAttribute('href', downloadUrl);

    await page.getByRole('button', { name: 'Menu' }).click();
    const navigationLinks = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Download Android test app' });
    await expect(navigationLinks).toHaveAttribute('href', downloadUrl);
  });

  test('the home page has no axe violations', async ({ page }) => {
    await page.goto('/en');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
