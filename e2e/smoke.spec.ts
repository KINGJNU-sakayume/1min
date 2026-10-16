import { expect, test } from '@playwright/test';

test('앱이 /1min/ 경로에서 뜨고 패러디 고지가 보인다', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '1분 전' })).toBeVisible();
  await expect(page.getByText('패러디이며')).toBeVisible();
});

test('새로고침과 쿼리 문자열이 있어도 앱이 뜬다', async ({ page }) => {
  await page.goto('./?seed=ticketing%7C1%7CK7M2Q');
  await page.reload();
  await expect(page.getByRole('heading', { name: '1분 전' })).toBeVisible();
});
