import { expect, test } from '@playwright/test';

test.setTimeout(60000);

test('app shell loads without uncaught page errors', async ({ page }) => {
  const pageErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  const response = await page.goto('/', { waitUntil: 'commit' });

  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('#root')).toBeAttached();
  await expect(page).toHaveURL(/127\.0\.0\.1:4173/);
  await page.waitForTimeout(1000);
  expect(pageErrors).toEqual([]);
});
