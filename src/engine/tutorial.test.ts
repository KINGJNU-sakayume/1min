import { describe, expect, it } from 'vitest';
import { playWithBot } from './bot/solver';
import { computeResult } from './result';
import { createRun } from './run';
import { codes, content, ctxFor } from './test-utils';

describe('튜토리얼 (game-rules §10, stage-format §10.10)', () => {
  it('시드와 무관한 고정 스케줄', () => {
    const a = ctxFor('tutorial', 0, 'AAAAA').schedule.entries;
    const b = ctxFor('tutorial', 0, 'ZZZZZ').schedule.entries;
    expect(a.map((e) => [e.cardId, e.anchor])).toEqual(b.map((e) => [e.cardId, e.anchor]));
    expect(a.map((e) => content().cards.get(e.cardId)?.surface).sort()).toEqual([
      'ambient',
      'overlay',
    ]);
  });

  it('"안내대로만" 하는 느린 봇이 100% 성공한다 (200 시드)', () => {
    for (const code of codes(200, 42)) {
      const setup = createRun(
        content(),
        { stageId: 'tutorial', level: 0, code },
        { assist: false },
      );
      const { state } = playWithBot(setup.ctx, content().director.guided);
      expect(state.outcome, code).toBe('success');
      const r = computeResult(setup.ctx, state);
      expect(r.titleId).toBe('success');
      // 시간 여유가 넉넉하다: 90초 중 절반 이상 남는다
      expect(r.remainingTicks).toBeGreaterThan(setup.ctx.durationTicks / 2);
    }
  });

  it('실패 조건은 시간 초과뿐 (아무것도 안 하면 timeout)', () => {
    const ctx = ctxFor('tutorial', 0, 'K7M2Q');
    const { state } = playWithBot(ctx, {
      reactionTicks: 1e6,
      actionGapTicks: 1e6,
      typeTicksPerChar: 0,
      openDelayTicks: 0,
      stepReadTicks: 1e6,
    });
    expect(state.reason).toBe('timeout');
    expect(ctx.durationTicks).toBe(1800);
  });
});
