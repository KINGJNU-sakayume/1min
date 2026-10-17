/**
 * 아이콘 PNG 생성 (개발용, 결과물은 커밋한다): npx tsx scripts/make-icons.ts
 * public/icons/*.svg → 192·512·180(apple-touch)·maskable 512 PNG
 */
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const local = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(existsSync(local) ? { executablePath: local } : {});
const page = await browser.newPage();
const jobs: [string, string, number][] = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon.svg', 'apple-touch-icon.png', 180],
  ['maskable.svg', 'maskable-512.png', 512],
];
for (const [src, out, size] of jobs) {
  const svg = readFileSync(`public/icons/${src}`, 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({
    path: `public/icons/${out}`,
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  console.log(`public/icons/${out}`);
}
await browser.close();
