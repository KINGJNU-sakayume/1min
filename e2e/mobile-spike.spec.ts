import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface Probe {
  id: string;
  label: string;
  value: string;
  ok: boolean | null;
}

test('모바일 스파이크: 프로브 결과 수집', async ({
  page,
  browserName,
  context,
  isMobile,
}, info) => {
  test.skip(!isMobile, '터치 뷰포트 전용');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  await page.goto('./spike.html');
  await expect(page.locator('#probes tr').first()).toBeVisible();

  // ① 입력창 포커스 → 키보드(에뮬레이션에서는 실제로 안 올라옴)
  await page.locator('#captcha').tap();
  // ④ 탭 후 오디오
  await page.locator('#audio').tap();
  // ⑤ 공유 폴백
  await page.locator('#share').tap();
  await expect(page.locator('[data-probe="shareResult"]')).toBeVisible();
  await expect(page.locator('[data-probe="audioUnlock"]')).toBeVisible();

  // 하단 버튼이 화면 안에 있고 44px 이상인지
  const box = await page.locator('#confirm').boundingBox();
  expect(box && box.height).toBeGreaterThanOrEqual(44);

  const probes = await page.evaluate(() => (window as unknown as { __spike: Probe[] }).__spike);
  mkdirSync('test-results', { recursive: true });
  writeFileSync(
    `test-results/spike-${info.project.name}.json`,
    JSON.stringify({ browserName, project: info.project.name, probes }, null, 2),
  );
  expect(probes.length).toBeGreaterThan(5);
});
