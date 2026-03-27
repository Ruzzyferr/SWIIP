import { expect, test } from '@playwright/test';

test('terms checkbox visibly toggles on register page', async ({ page }) => {
  await page.goto('/register');

  const checkbox = page.locator('#terms');
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();

  await page.locator('label:has(#terms)').click({ position: { x: 10, y: 10 } });
  await expect(checkbox).toBeChecked();
});
