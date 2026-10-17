import { expect, test } from '@playwright/test';

test('튜토리얼: 안내를 보며 끝내면 티켓팅이 열리고, 기록이 새로고침 뒤에도 남는다', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await expect(page.getByTestId('stage-ticketing')).toContainText(
    '앞 스테이지를 한 번 해 보면 열립니다',
  );
  await page.getByTestId('stage-tutorial').click();
  await page.getByTestId('start').click();
  await page.getByTestId('ready').click();
  await expect(page.getByTestId('hint')).toContainText('파일명 규칙');
  await page.getByTestId('opt-final').click();
  // 알림 카드는 무시, 팝업 카드는 안내대로 허용
  for (const step of ['파일 업로드', '제출하기']) {
    const allow = page.locator('[data-testid$="-allow"]');
    if (await allow.isVisible().catch(() => false)) await allow.click();
    await page.getByRole('button', { name: step }).click({ timeout: 15_000 });
  }
  await expect(page.getByTestId('result-title')).toHaveText('제출 완료, 인간 승리', {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: '처음으로' }).click();
  await page.reload();
  await expect(page.getByTestId('stage-ticketing')).not.toContainText('앞 스테이지를');
  await expect(page.getByTestId('stage-tutorial')).toContainText('최고 기록');
});

test('공유받은 시드 링크는 잠긴 스테이지도 바로 열린다', async ({ page }) => {
  await page.goto('./?seed=ticketing%7C2%7CK7M2Q');
  await expect(page.getByTestId('seed')).toHaveValue('K7M2Q');
  await expect(page.getByTestId('start')).toBeEnabled();
});

test('다른 버전의 공유 링크는 안내를 보여 준다', async ({ page }) => {
  await page.goto('./?seed=ticketing%7C2%7CK7M2Q&v=000000');
  await expect(page.getByText('다른 판이 될 수 있습니다')).toBeVisible();
});

test('시간 연장 설정은 저장되고 타이머가 90초로 시작한다', async ({ page }) => {
  await page.goto('./?seed=ticketing%7C1%7CK7M2Q');
  await page.getByTestId('setting-assist').check();
  await page.reload();
  await expect(page.getByTestId('setting-assist')).toBeChecked();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('timer')).toHaveText('90.0');
});

test('localStorage가 막혀도 앱이 뜨고 판을 시작할 수 있다', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });
  await page.goto('./?seed=ticketing%7C1%7CK7M2Q');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('ready')).toBeVisible();
});
