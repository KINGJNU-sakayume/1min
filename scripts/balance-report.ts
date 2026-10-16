/**
 * 밸런스 리포트 (개발용): 난이도별로 솔버 봇과 "느린 사람" 봇을 돌려 분포를 본다.
 * 사용: npx tsx scripts/balance-report.ts [stageId]
 */
import { loadContent } from '../src/content/load';
import { playWithBot } from '../src/engine/bot/solver';
import { computeResult } from '../src/engine/result';
import { createRun } from '../src/engine/run';
import { SEED_CODE_ALPHABET } from '../src/engine/seed';

const stageId = process.argv[2] ?? 'ticketing';
const content = loadContent().engine;
const N = 200;
const codes = Array.from({ length: N }, (_, i) =>
  Array.from(
    { length: 5 },
    (_, k) => SEED_CODE_ALPHABET[(i * 7 + k * 13 + i * k) % SEED_CODE_ALPHABET.length],
  ).join(''),
);
const humanish = content.director.humanish;
const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);

for (let level = 1; level <= 5; level++) {
  const retries: number[] = [];
  const shown: number[] = [];
  const remainSolver: number[] = [];
  let humanWins = 0;
  const remainHuman: number[] = [];
  for (const code of codes) {
    const setup = createRun(content, { stageId, level, code }, { assist: false });
    retries.push(setup.retries);
    const solver = playWithBot(setup.ctx, content.director.solver);
    const r = computeResult(setup.ctx, solver.state);
    shown.push(r.timeline.length);
    remainSolver.push(r.remainingTicks / 20);
    const human = playWithBot(setup.ctx, humanish);
    if (human.state.outcome === 'success') {
      humanWins++;
      remainHuman.push(computeResult(setup.ctx, human.state).remainingTicks / 20);
    }
  }
  console.log(
    `L${level}: 재시도>0 ${retries.filter((r) => r > 0).length}/${N}, 뜬 카드 평균 ${avg(shown)}, 솔버 남은초 ${avg(remainSolver)}, 느린봇 성공 ${humanWins}/${N} (남은초 ${avg(remainHuman)})`,
  );
}
