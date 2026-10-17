import { describe, expect, it } from 'vitest';
import { playWithBot } from './bot/solver';
import { createRun } from './run';
import { computeResult } from './result';
import { codes, content, ctxFor } from './test-utils';

describe('솔버 봇 (공정성, stage-format §10.9)', () => {
  const seeds = codes(200, 99);

  for (const level of [1, 2, 3, 4, 5]) {
    it(`티켓팅 난이도 ${level}: 200 시드 모두 검증된 판이 만들어진다`, () => {
      const retries: number[] = [];
      for (const code of seeds) {
        const setup = createRun(
          content(),
          { stageId: 'ticketing', level, code },
          { assist: false },
        );
        expect(setup.verified, `${code} 검증 실패`).toBe(true);
        retries.push(setup.retries);
        // 검증된 판은 같은 봇이 다시 해도 성공 (결정론)
        const replay = playWithBot(setup.ctx, content().director.solver);
        expect(replay.state.outcome).toBe('success');
      }
      const rejected = retries.filter((r) => r > 0).length;
      // 너무 많이 거부되면 디렉터 밸런스 문제다
      expect(rejected / seeds.length).toBeLessThan(0.5);
    });
  }

  it('난이도 0 (고정 스케줄)도 봇이 성공한다', () => {
    const ctx = ctxFor('ticketing', 0, 'AAAAA');
    expect(playWithBot(ctx, content().director.solver).state.outcome).toBe('success');
  });

  it('결과 객체: 칭호·별점·타임라인', () => {
    const ctx = ctxFor('ticketing', 3, 'K7M2Q');
    const { state } = playWithBot(ctx, content().director.solver);
    const r = computeResult(ctx, state);
    expect(r.outcome).toBe('success');
    expect(r.title.startsWith('copy:result.ticketing.success')).toBe(true);
    expect(r.stars).toBeGreaterThanOrEqual(1);
    for (const t of r.timeline) expect(t.end).toBeGreaterThanOrEqual(t.start);
  });

  it('아무것도 안 하면 fail-default류 칭호', () => {
    const setup = createRun(
      content(),
      { stageId: 'ticketing', level: 1, code: 'K7M2Q' },
      { assist: false },
    );
    const ctx = setup.ctx;
    // start만 한 판
    const { state } = playWithBot(
      { ...ctx, stage: { ...ctx.stage, steps: ctx.stage.steps } },
      {
        reactionTicks: 99999,
        actionGapTicks: 99999,
        typeTicksPerChar: 0,
        openDelayTicks: 99999,
        stepReadTicks: 0,
      },
    );
    expect(state.outcome).toBe('fail');
    const r = computeResult(ctx, state);
    expect(r.titleId.startsWith('fail-')).toBe(true);
    expect(r.stars).toBe(0);
  });
});
