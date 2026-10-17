// 빌드 후 서비스 워커 생성: dist의 모든 파일을 미리 캐시해 오프라인에서도 판을 돌린다.
// 캐시 이름에 파일 목록 해시를 넣어, 새 배포가 오면 예전 캐시를 지운다.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = 'dist';
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk(dist)
  .map((p) => relative(dist, p).split('\\').join('/'))
  .filter((f) => f !== 'sw.js' && f !== 'spike.html' && !f.startsWith('assets/spike'))
  .sort();
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);
const template = readFileSync('scripts/sw-template.js', 'utf8');
writeFileSync(
  join(dist, 'sw.js'),
  template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(['./', ...files])),
);
console.log(`dist/sw.js 생성 (${files.length}개 파일, 캐시 ${version})`);
