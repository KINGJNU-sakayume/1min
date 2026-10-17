import { expect, test } from '@playwright/test';

test('PWA: 매니페스트·아이콘이 /1min/ 아래에 있다', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/1min/manifest.webmanifest');
  const manifest = (await (await request.get(href!)).json()) as {
    start_url: string;
    scope: string;
    icons: { src: string }[];
  };
  expect(manifest.start_url).toBe('/1min/');
  expect(manifest.scope).toBe('/1min/');
  for (const icon of manifest.icons) {
    expect((await request.get(`/1min/${icon.src}`)).status()).toBe(200);
  }
  expect(
    (
      await request.get(
        (await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')) ?? '',
      )
    ).status(),
  ).toBe(200);
});

test('PWA: 서비스 워커가 앱 실행에 필요한 파일을 전부 캐시한다', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // 지금 페이지가 쓰는 스크립트·스타일·셸이 모두 캐시에 있어야 오프라인에서 뜬다
  const missing = await page.evaluate(async () => {
    const urls = [
      './',
      ...[
        ...document.querySelectorAll('script[src], link[rel="stylesheet"], link[rel="manifest"]'),
      ].map((el) => el.getAttribute('src') ?? el.getAttribute('href') ?? ''),
    ];
    const out: string[] = [];
    for (const u of urls) if (!(await caches.match(new URL(u, location.href).href))) out.push(u);
    return out;
  });
  expect(missing).toEqual([]);
});

test('PWA: 서비스 워커가 깔린 뒤 오프라인에서도 앱이 뜨고 판을 시작한다', async ({
  page,
  context,
  browserName,
}) => {
  // Playwright WebKit(리눅스)의 오프라인 흉내는 서비스 워커를 거치지 않고 이동 자체를 실패시킨다.
  // WebKit에서는 위의 캐시 검사로 같은 성질을 확인하고, 실제 비행기 모드 확인은 실기기 항목이다.
  test.skip(browserName === 'webkit', 'Playwright WebKit setOffline 한계 — 캐시 검사로 대체');
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // 컨트롤러가 붙은 상태로
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
    .toBe(true);
  await context.setOffline(true);
  await page.goto('./?seed=ticketing%7C1%7CK7M2Q');
  await expect(page.getByRole('heading', { name: '1분 전' })).toBeVisible();
  await page.getByTestId('start').click();
  await page.getByTestId('ready').click();
  await expect(page.getByTestId('open')).toBeVisible();
  await context.setOffline(false);
});
