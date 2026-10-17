/**
 * 콘텐츠 게이트: zod 스키마 + 교차 검증 + 금지어 검사. 실패하면 exit 1 (CI·build에서 실행).
 * 사용: npm run check:content  (dist/가 있으면 빌드 산출물도 금지어 검사)
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  buildMatchers,
  parseForbiddenList,
  scanText,
  type ForbiddenHit,
} from '../src/content/forbidden';
import { validateAllContent } from '../src/content/validate';

const root = process.cwd();
const errors: string[] = [];

// 1) 스키마·교차 검증
errors.push(...validateAllContent());

// 2) 금지어
const SCAN_TARGETS = ['src', 'content', 'public', 'index.html', 'spike.html', 'README.md', 'dist'];
const SKIP_EXT = /\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp3|ogg|wav)$/i;
const matchers = buildMatchers(
  parseForbiddenList(readFileSync(join(root, 'scripts/forbidden-words.txt'), 'utf8')),
);

const walk = (p: string): string[] => {
  if (!existsSync(p)) return [];
  if (statSync(p).isDirectory()) return readdirSync(p).flatMap((c) => walk(join(p, c)));
  return SKIP_EXT.test(p) ? [] : [p];
};

const hits: ForbiddenHit[] = SCAN_TARGETS.flatMap((t) => walk(join(root, t))).flatMap((f) =>
  scanText(relative(root, f), readFileSync(f, 'utf8'), matchers),
);
for (const h of hits) errors.push(`금지어 "${h.word}": ${h.file}:${h.line}`);

if (errors.length > 0) {
  console.error(`콘텐츠 검사 실패 (${errors.length}건)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('콘텐츠 검사 통과');
