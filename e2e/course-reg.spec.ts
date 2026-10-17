import { expect, test, type Page } from '@playwright/test';

const closePopups = async (page: Page) => {
  const btn = page.locator(
    '[role="alertdialog"] button, [data-testid$="-ok"], [data-testid$="-extend"], [data-testid$="-allow"]',
  );
  while ((await btn.count()) > 0)
    await btn
      .first()
      .click({ timeout: 1000 })
      .catch(() => undefined);
};

/** 수강신청 한 판: 정각 전 "기간이 아닙니다" → 정각 뒤 인기 과목부터 신청 → 신청 완료 → 내역 확인 */
test('수강신청 난이도 1: 화면으로 끝까지', async ({ page }, info) => {
  test.setTimeout(120_000);
  const shot = (name: string) =>
    process.env.SHOTS_DIR
      ? page.screenshot({ path: `${process.env.SHOTS_DIR}/${info.project.name}-${name}.png` })
      : undefined;
  await page.goto('./?seed=course-reg%7C1%7CK7M2Q');
  await page.getByTestId('start').click();
  await page.getByTestId('ready').click();
  await page.getByTestId('confirm').click();
  await page.getByTestId('apply-ds').click();
  await expect(page.getByText('수강신청 기간이 아닙니다!')).toBeVisible();
  await shot('course-notperiod');
  await page.getByRole('button', { name: '확인' }).click();
  await expect(page.getByText(/목표: 3과목/)).toBeVisible({ timeout: 10_000 });

  // 정각: 장바구니 인원이 정원보다 많은 과목부터 빠르게
  for (const id of ['wine', 'nap', 'ds', 'writing', 'calculus']) {
    await closePopups(page);
    await page
      .getByTestId(`apply-${id}`)
      .click({ timeout: 2000 })
      .catch(() => undefined);
  }
  await shot('course-pending');

  const deadline = Date.now() + 80_000;
  while (Date.now() < deadline && !(await page.getByTestId('result-title').isVisible())) {
    await closePopups(page);
    if (await page.getByTestId('confirm').isVisible()) {
      await expect(page.getByTestId('summary')).toContainText('과목');
      await shot('course-timetable');
      await page.getByTestId('confirm').click();
    } else if ((await page.locator('[data-status="success"]').count()) >= 3) {
      await page
        .getByTestId('course-done')
        .click({ timeout: 1000 })
        .catch(() => undefined);
    } else {
      const idle = page.locator('[data-status="idle"] button');
      if ((await idle.count()) > 0)
        await idle
          .first()
          .click({ timeout: 1000 })
          .catch(() => undefined);
    }
    await page.waitForTimeout(200);
  }
  await shot('course-result');
  // 느리게 누르면 인기 과목이 마감되어 질 수도 있다 — 승패와 무관하게 결과 화면까지 간다
  await expect(page.getByTestId('result-title')).toBeVisible();
});
