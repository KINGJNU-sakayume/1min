import { expect, test, type Page } from '@playwright/test';

/**
 * 티켓팅 한 판을 화면만 보고 끝까지 진행한다 (M2 완료 기준: "손으로 한 판을 끝까지").
 * 카드는 화면에 보이는 버튼으로 해결하고, 미끼(새로고침·새 탭·알림)는 누르지 않는다.
 */
async function playOnce(page: Page) {
  await page.getByTestId('start').click();
  await page.getByTestId('ready').click();
  await expect(page.getByTestId('open')).toHaveText('예매하기', { timeout: 10_000 });
  await page.getByTestId('open').click();

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await page.getByTestId('result-title').isVisible()) return;
    // 카드: 해결 버튼(확인·허용·키보드 내리기·닫기·결제수단 유지)과 type 카드
    const cardButton = page.locator(
      '[data-testid^="card-"][data-testid$="-allow"], [data-testid^="card-"][data-testid$="-ok"], [data-testid^="card-"][data-testid$="-hide"], [data-testid$="-opt-close"], [data-testid$="-opt-keep"]',
    );
    if ((await cardButton.count()) > 0) {
      await cardButton
        .first()
        .click({ timeout: 2000 })
        .catch(() => undefined);
      continue;
    }
    const cardCode = page.locator('[data-testid^="card-"][data-testid$="-code"]');
    if ((await cardCode.count()) > 0) {
      const idx = (await cardCode.first().getAttribute('data-testid'))?.split('-')[1];
      await page
        .getByTestId(`card-${idx}-input`)
        .fill((await cardCode.first().getAttribute('data-code')) ?? '');
      await page.getByTestId(`card-${idx}-submit`).click();
      continue;
    }
    if (
      await page
        .locator('[role="alertdialog"] button')
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await page.locator('[role="alertdialog"] button').first().click();
      continue;
    }
    if (
      await page
        .locator('[role="status"] .animate-spin, [role="status"]:has-text("잠시 후")')
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await page.waitForTimeout(200);
      continue;
    }
    if (await page.getByTestId('text-input').isVisible()) {
      const src = page.locator('[data-testid="captcha"], [data-testid="birth"]').first();
      await page.getByTestId('text-input').fill((await src.getAttribute('data-code')) ?? '');
      await page.getByTestId('text-submit').click();
    } else if (await page.getByTestId('seat-confirm').isVisible()) {
      const mine = page.locator('[data-view="mine"]');
      if ((await mine.count()) > 0) await page.getByTestId('seat-confirm').click();
      else {
        const free = page.locator('[data-view="free"]');
        if ((await free.count()) > 0) await free.first().click();
        else await page.locator('[data-testid^="zone-"]').last().click();
      }
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
  throw new Error('판이 끝나지 않음');
}

test('티켓팅 난이도 1: 화면으로 끝까지 해서 성공 칭호를 본다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./?seed=ticketing%7C1%7CK7M2Q');
  await playOnce(page);
  await expect(page.getByText('예매 완료')).toBeVisible();
});

test('티켓팅 난이도 3: 가격·주문자 단계까지 끝낸다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./?seed=ticketing%7C3%7CK7M2Q');
  await playOnce(page);
  await expect(page.getByTestId('result-title')).toBeVisible();
});

test('정각 전에 누르면 "아직 오픈 전입니다"', async ({ page }) => {
  await page.goto('./?seed=ticketing%7C1%7CK7M2Q');
  await page.getByTestId('start').click();
  await page.getByTestId('ready').click();
  await page.getByTestId('open').click();
  await expect(page.getByText('아직 오픈 전입니다')).toBeVisible();
});
