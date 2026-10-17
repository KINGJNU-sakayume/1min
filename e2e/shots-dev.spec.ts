// 개발용 스크린샷 (CI에서 실행하지 않음): SHOTS_DIR=... npx playwright test e2e/shots.dev.ts
import { test } from '@playwright/test';

test.skip(!process.env.SHOTS_DIR, 'SHOTS_DIR 없으면 건너뜀');

test('단계별 스크린샷', async ({ page }, info) => {
  test.setTimeout(120_000);
  const dir = process.env.SHOTS_DIR ?? '.';
  const snap = (name: string) =>
    page.screenshot({ path: `${dir}/${info.project.name}-${name}.png` });
  await page.goto('./?seed=ticketing%7C3%7CK7M2Q');
  await page.getByTestId('start').click();
  await page.getByTestId('ready').click();
  await page.getByTestId('open').filter({ hasText: '예매하기' }).click({ timeout: 10_000 });
  const seen = new Set<string>();
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    for (const id of ['text-input', 'seat-confirm', 'price-next', 'pay', 'result-title']) {
      if (!seen.has(id) && (await page.getByTestId(id).isVisible())) {
        seen.add(id);
        await page.waitForTimeout(300);
        await snap(id);
      }
    }
    if (await page.getByTestId('result-title').isVisible()) return;
    const modal = page.locator('[role="alertdialog"], [role="dialog"]');
    if ((await modal.count()) > 0 && !seen.has('card')) {
      seen.add('card');
      await snap('card');
    }
    const btn = page.locator(
      '[data-testid$="-allow"], [data-testid$="-ok"], [data-testid$="-hide"], [data-testid$="-opt-close"], [data-testid$="-opt-keep"], [role="alertdialog"] button',
    );
    if ((await btn.count()) > 0) {
      await btn
        .first()
        .click()
        .catch(() => undefined);
      continue;
    }
    const code = page.locator('[data-testid$="-code"]');
    if ((await code.count()) > 0) {
      const idx = (await code.first().getAttribute('data-testid'))?.split('-')[1];
      await page
        .getByTestId(`card-${idx}-input`)
        .fill((await code.first().getAttribute('data-code')) ?? '');
      await page.getByTestId(`card-${idx}-submit`).click();
      continue;
    }
    if (await page.getByTestId('text-input').isVisible()) {
      const src = page.locator('[data-testid="captcha"], [data-testid="birth"]').first();
      await page.getByTestId('text-input').fill((await src.getAttribute('data-code')) ?? '');
      await page.getByTestId('text-submit').click();
    } else if (await page.getByTestId('seat-confirm').isVisible()) {
      if ((await page.locator('[data-view="mine"]').count()) > 0)
        await page.getByTestId('seat-confirm').click();
      else
        await page
          .locator('[data-view="free"]')
          .first()
          .click()
          .catch(() => undefined);
    } else if (await page.getByTestId('price-next').isVisible()) {
      if ((await page.getByTestId('qty').textContent())?.startsWith('0'))
        await page.getByTestId('qty-plus').click();
      else await page.getByTestId('price-next').click();
    } else if (await page.getByTestId('pay').isVisible()) {
      if (!(await page.getByTestId('method-card').isChecked()))
        await page.getByTestId('method-card').click();
      else if (!(await page.getByTestId('agree').isChecked()))
        await page.getByTestId('agree').click();
      else await page.getByTestId('pay').click();
    }
    await page.waitForTimeout(150);
  }
});
