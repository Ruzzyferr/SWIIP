import { expect, test } from '@playwright/test';

const routes = ['/login', '/register', '/forgot-password', '/terms', '/privacy'];

for (const path of routes) {
  test(`public route responds: ${path}`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${path} should not be 404/500`).toBeLessThan(500);
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}`));
  });
}
