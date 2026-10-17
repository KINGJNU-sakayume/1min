import { describe, expect, it } from 'vitest';
import { playWithBot } from './bot/solver';
import { conflicts } from './content';
import { makeContext } from './run';
import { createInitialState, step } from './reducer';
import { content, ctxFor, codes, stageOf } from './test-utils';
import type { Input, RunContext, RunState, Schedule } from './types';

const tap = (tick: number, target: string): Input => ({ tick, action: 'tap', target });

/** 입력 목록을 틱 순서대로 흘려보내고, 매 틱 상태를 기록한다 */
function run(ctx: RunContext, inputs: Input[], untilTick?: number) {
  let s = step(ctx, createInitialState(ctx), [{ tick: 0, action: 'start', target: 'run' }]).state;
  const limit = untilTick ?? ctx.t0 + ctx.durationTicks + 1;
  const events = [];
  while (s.phase !== 'RESULT' && s.tick <= limit) {
    const out = step(
      ctx,
      s,
      inputs.filter((i) => i.tick === s.tick),
    );
    events.push(...out.events);
    s = out.state;
  }
  return { s, events };
}

/** 카드 없는 티켓팅 판 (단계 로직만 검증) */
function bare(level = 3): RunContext {
  const stage = stageOf('ticketing');
  const schedule: Schedule = {
    stageId: stage.id,
    level,
    seedString: `ticketing|${level}|BARE2`,
    contentVersion: content().contentVersion,
    spent: 0,
    entries: [],
  };
  return makeContext(content(), stage, level, schedule, { assist: false });
}

/** 카드 하나만 있는 판 */
function withCard(
  cardId: string,
  anchor: Schedule['entries'][number]['anchor'],
  level = 3,
  extra: Partial<Schedule['entries'][number]> = {},
) {
  const base = bare(level);
  const schedule: Schedule = { ...base.schedule, entries: [{ idx: 0, cardId, anchor, ...extra }] };
  return makeContext(content(), base.stage, level, schedule, { assist: false });
}

describe('상태 머신', () => {
  it('READY에서는 시간이 흐르지 않고 start로 PREROLL', () => {
    const ctx = bare();
    const s0 = createInitialState(ctx);
    expect(step(ctx, s0, []).state).toEqual(s0);
    const s1 = step(ctx, s0, [{ tick: 0, action: 'start', target: 'run' }]).state;
    expect(s1.phase).toBe('PREROLL');
    expect(s1.tick).toBe(0);
  });

  it('T0에 RUNNING이 되고, 아무것도 안 하면 60초 뒤 timeout', () => {
    const ctx = bare();
    const { s } = run(ctx, []);
    expect(s.outcome).toBe('fail');
    expect(s.reason).toBe('timeout');
    expect(s.finishedAt).toBe(ctx.t0 + 1200);
  });

  it('assist는 판 길이를 늘린다', () => {
    const stage = stageOf('ticketing');
    const ctx = makeContext(content(), stage, 1, bare(1).schedule, { assist: true });
    expect(ctx.durationTicks).toBe(Math.round(1200 * content().director.assistDurationFactor));
  });
});

describe('정각 판정 경계 (game-rules §5)', () => {
  const cases: [number, string][] = [
    [0, 'PERFECT'],
    [2, 'PERFECT'],
    [3, 'GOOD'],
    [11, 'GOOD'],
    [12, 'LATE'],
    [39, 'LATE'],
    [40, 'SLOW'],
  ];
  it.each(cases)('T0+%i틱 → %s', (delta, judgment) => {
    const ctx = bare();
    const { s } = run(
      ctx,
      [{ tick: ctx.t0 + delta, action: 'open', target: 'step:open' }],
      ctx.t0 + delta + 1,
    );
    expect(s.judgment).toBe(judgment);
    expect(ctx.stage.steps[s.stepIndex]?.id).toBe('queue');
  });

  it('EARLY: 잠금 16틱 + 다시 눌러야 하고 판정은 EARLY', () => {
    const ctx = bare();
    const t0 = ctx.t0;
    const { s, events } = run(
      ctx,
      [
        { tick: t0 - 5, action: 'open', target: 'step:open' },
        { tick: t0 + 2, action: 'open', target: 'step:open' }, // 잠금 중 (t0-5+16 = t0+11)
        { tick: t0 + 12, action: 'open', target: 'step:open' },
      ],
      t0 + 13,
    );
    expect(events.some((e) => e.type === 'early')).toBe(true);
    expect(events.some((e) => e.type === 'locked')).toBe(true);
    expect(s.judgment).toBe('EARLY');
    expect(s.stats.earlyPress).toBe(1);
  });

  it('판정이 좋을수록 대기 인원이 적다', () => {
    const count = (delta: number) => {
      const ctx = bare();
      const { s } = run(
        ctx,
        [{ tick: ctx.t0 + delta, action: 'open', target: 'step:open' }],
        ctx.t0 + delta + 1,
      );
      return s.step.kind === 'queue' ? s.step.initial : NaN;
    };
    expect(count(0)).toBeLessThan(count(5));
    expect(count(5)).toBeLessThan(count(20));
    expect(count(20)).toBeLessThan(count(60));
  });
});

describe('단계', () => {
  it('대기열은 결정적으로 0이 되고, 새로고침하면 맨 뒤로', () => {
    const ctx = bare();
    const open = { tick: ctx.t0, action: 'open' as const, target: 'step:open' };
    const plain = run(ctx, [open], ctx.t0 + 300).s;
    expect(ctx.stage.steps[plain.stepIndex]?.id).toBe('captcha');
    const refreshed = run(ctx, [open, tap(ctx.t0 + 3, 'step:refresh')], ctx.t0 + 30).s;
    expect(refreshed.stats.queueResets).toBe(1);
    expect(refreshed.step.kind === 'queue' && refreshed.step.count).toBeGreaterThan(5000);
  });

  it('난이도 2 이하에서 price·buyer는 자동 통과, 3에서는 등장', () => {
    const skipped = (level: number) => {
      const { events } = run(
        bare(level),
        playWithBot(bare(level), content().director.solver).inputs,
      );
      return events
        .filter((e) => e.type === 'stepSkipped')
        .map((e) => (e.type === 'stepSkipped' ? e.stepId : ''));
    };
    expect(skipped(2)).toEqual(['price', 'buyer']);
    expect(skipped(3)).toEqual([]);
  });

  it('결제 제한 시간이 끝나면 좌석 선택으로 되돌아간다', () => {
    const ctx = bare(3);
    const bot = playWithBot(ctx, content().director.solver);
    // 결제 단계에 들어간 뒤의 입력을 지운다
    const { events: botEvents } = run(ctx, bot.inputs);
    const payEnter = botEvents.findIndex((e) => e.type === 'stepEnter' && e.stepId === 'pay');
    expect(payEnter).toBeGreaterThan(0);
    const payTick = (() => {
      let s = step(ctx, createInitialState(ctx), [
        { tick: 0, action: 'start', target: 'run' },
      ]).state;
      while (ctx.stage.steps[s.stepIndex]?.id !== 'pay')
        s = step(
          ctx,
          s,
          bot.inputs.filter((i) => i.tick === s.tick),
        ).state;
      return s.tick;
    })();
    const cut = bot.inputs.filter((i) => i.tick < payTick);
    const { s, events } = run(ctx, cut, payTick + 410);
    expect(events.some((e) => e.type === 'stepTimeout' && e.stepId === 'pay')).toBe(true);
    expect(ctx.stage.steps[s.stepIndex]?.id).toBe('seat');
    expect(s.stats.stepTimeouts).toBe(1);
  });

  it('수량 0매로 다음 단계를 누르면 팝업, 1매로 바꾸면 통과', () => {
    const ctx = bare(3);
    let s = createInitialState(ctx);
    s = step(ctx, s, [{ tick: 0, action: 'start', target: 'run' }]).state;
    // 봇으로 price 단계까지 간다
    const bot = playWithBot(ctx, content().director.solver);
    while (ctx.stage.steps[s.stepIndex]?.id !== 'price')
      s = step(
        ctx,
        s,
        bot.inputs.filter((i) => i.tick === s.tick),
      ).state;
    const t = s.tick;
    s = step(ctx, s, [tap(t, 'step:next')]).state;
    expect(s.step.kind === 'quantity' && s.step.popup).toBe('zero');
    s = step(ctx, s, [tap(t + 1, 'step:qty-plus')]).state; // 팝업 중엔 무시
    expect(s.step.kind === 'quantity' && s.step.qty).toBe(0);
    s = step(ctx, s, [tap(t + 2, 'step:popup-ok')]).state;
    s = step(ctx, s, [tap(t + 3, 'step:qty-plus')]).state;
    s = step(ctx, s, [tap(t + 4, 'step:next')]).state;
    expect(ctx.stage.steps[s.stepIndex]?.id).toBe('buyer');
  });
});

describe('카드 효과', () => {
  const toQueue = (ctx: RunContext): Input[] => [
    { tick: ctx.t0, action: 'open', target: 'step:open' },
  ];

  it('blocksStep 카드는 단계 입력을 막고, 해결하면 풀린다', () => {
    const ctx = withCard('common.popup-blocked', { kind: 'run', tick: 0 });
    const t0 = ctx.t0;
    const blocked = run(ctx, [{ tick: t0 + 1, action: 'open', target: 'step:open' }], t0 + 2);
    expect(blocked.s.stats.blockedInputs).toBe(1);
    expect(blocked.s.judgment).toBeNull();
    const solved = run(
      ctx,
      [tap(t0 + 1, 'card:0:allow'), { tick: t0 + 2, action: 'open', target: 'step:open' }],
      t0 + 3,
    );
    expect(solved.s.cards[0]?.status).toBe('resolved');
    expect(solved.s.judgment).toBe('PERFECT');
  });

  it('wait 카드: 미끼를 누르면 실패 효과, 가만두면 만료 = 해결', () => {
    const ctx = withCard(
      'ticketing.refresh-temptation',
      { kind: 'step', stepId: 'queue', offset: 0 },
      5,
    );
    const touched = run(ctx, [...toQueue(ctx), tap(ctx.t0 + 2, 'step:refresh')], ctx.t0 + 3).s;
    expect(touched.cards[0]?.status).toBe('failed');
    expect(touched.stats.queueResets).toBe(1);
    const left = run(ctx, toQueue(ctx), ctx.t0 + 1 + 125).s;
    expect(left.cards[0]?.status).toBe('resolved');
    expect(left.stats.failed ?? 0).toBe(0);
  });

  it('ignore 카드: 알림을 누르면 잠금', () => {
    const ctx = withCard('common.messenger-ping', { kind: 'run', tick: 0 });
    const { s } = run(ctx, [tap(ctx.t0 + 1, 'card:0:banner')], ctx.t0 + 2);
    expect(s.cards[0]?.status).toBe('failed');
    expect(s.lockUntil).toBe(ctx.t0 + 1 + 20);
  });

  it('server-lag: 처리 중에 단계를 누르면 중복 요청 잠금', () => {
    const ctx = withCard('common.server-lag', { kind: 'run', tick: 0 });
    const { s } = run(ctx, [{ tick: ctx.t0 + 1, action: 'open', target: 'step:open' }], ctx.t0 + 2);
    expect(s.cards[0]?.status).toBe('failed');
    expect(s.lockUntil).toBeGreaterThan(ctx.t0 + 1);
  });

  it('type 카드: 코드를 맞히면 해결, 틀리면 유지', () => {
    const ctx = withCard('common.captcha', { kind: 'run', tick: 0 }, 3, { code: 'ABCD' });
    const t = ctx.t0 + 8; // 텔레그래프 400ms = 8틱
    const wrong = run(
      ctx,
      [{ tick: t + 1, action: 'type', target: 'card:0:submit', value: 'ABCE' }],
      t + 2,
    ).s;
    expect(wrong.cards[0]?.status).toBe('active');
    expect(wrong.stats.cardWrong).toBe(1);
    const right = run(
      ctx,
      [{ tick: t + 1, action: 'type', target: 'card:0:submit', value: 'abcd' }],
      t + 2,
    ).s;
    expect(right.cards[0]?.status).toBe('resolved');
  });

  it('choose 카드: 함정을 고르면 실패 효과(좌석으로 되돌림)', () => {
    const bot = playWithBot(bare(3), content().director.solver);
    const ctx = withCard(
      'ticketing.bank-transfer-trap',
      { kind: 'step', stepId: 'pay', offset: 0 },
      3,
    );
    let s = step(ctx, createInitialState(ctx), [{ tick: 0, action: 'start', target: 'run' }]).state;
    while (ctx.stage.steps[s.stepIndex]?.id !== 'pay')
      s = step(
        ctx,
        s,
        bot.inputs.filter((i) => i.tick === s.tick),
      ).state;
    for (let k = 0; k < 10; k++) s = step(ctx, s, []).state;
    expect(s.cards[0]?.status).toBe('active');
    s = step(ctx, s, [tap(s.tick, 'card:0:opt:bank')]).state;
    expect(s.cards[0]?.status).toBe('failed');
    expect(ctx.stage.steps[s.stepIndex]?.id).toBe('seat');
  });

  it('rateLimit: 창 안에서 maxTaps를 넘기면 잠금', () => {
    const ctx = withCard('common.rapid-click-limit', { kind: 'run', tick: 0 });
    const t = ctx.t0 + 1;
    const taps = [0, 1, 2, 3].map((k) => tap(t + k, 'step:whatever'));
    const { s } = run(ctx, taps, t + 5);
    expect(s.cards[0]?.status).toBe('failed');
    expect(s.stats.rateLimited).toBe(1);
  });

  it('seat-snipe: 활성 중 다음에 고른 빈 좌석이 직전에 팔린다', () => {
    const ctx = withCard('ticketing.seat-snipe', { kind: 'step', stepId: 'seat', offset: 0 }, 3);
    const bot = playWithBot(bare(3), content().director.solver);
    let s = step(ctx, createInitialState(ctx), [{ tick: 0, action: 'start', target: 'run' }]).state;
    while (ctx.stage.steps[s.stepIndex]?.id !== 'seat')
      s = step(
        ctx,
        s,
        bot.inputs.filter((i) => i.tick === s.tick),
      ).state;
    for (let k = 0; k < 10; k++) s = step(ctx, s, []).state;
    expect(s.cards[0]?.status).toBe('active');
    const free = botSeat(ctx, s);
    s = step(ctx, s, [tap(s.tick, `step:seat:${free}`)]).state;
    expect(s.step.kind === 'seatMap' && s.step.selected).toBeNull();
    expect(s.step.kind === 'seatMap' && s.step.popup).toBe('conflict');
    expect(s.stats.seatConflicts).toBe(1);
    // 확인 후 다른 좌석은 정상 선택
    s = step(ctx, s, [tap(s.tick, 'step:seat-ok')]).state;
    const next = botSeat(ctx, s);
    s = step(ctx, s, [tap(s.tick, `step:seat:${next}`)]).state;
    expect(s.step.kind === 'seatMap' && s.step.selected).toBe(next);
  });
});

function botSeat(ctx: RunContext, s: RunState): string {
  if (s.step.kind !== 'seatMap') throw new Error('좌석 단계 아님');
  const local = s.step;
  const zone = ctx.stage.steps.find((x) => x.kind === 'seatMap');
  if (zone?.kind !== 'seatMap') throw new Error();
  const ids = Object.keys(local.takenAt);
  const all = zone.seatMap.zones[0]!;
  for (let r = 0; r < all.rows; r++) {
    for (let c = 1; c <= all.cols; c++) {
      const id = `${all.id}-${'ABCDEFGHIJ'[r]}${c}`;
      if (!ids.includes(id) || (local.takenAt[id] ?? 0) > s.tick + 50) return id;
    }
  }
  throw new Error('빈 좌석 없음');
}

describe('런타임 불변식 (봇 300판)', () => {
  it('동시 활성 카드 ≤ maxSlots, 상호배제 카드는 동시에 활성이 아님', () => {
    for (const level of [3, 4, 5]) {
      for (const code of codes(60, level)) {
        const ctx = ctxFor('ticketing', level, code);
        let s = createInitialState(ctx);
        const bot = playWithBot(ctx, content().director.solver);
        s = step(ctx, s, [{ tick: 0, action: 'start', target: 'run' }]).state;
        while (s.phase !== 'RESULT') {
          s = step(
            ctx,
            s,
            bot.inputs.filter((i) => i.tick === s.tick),
          ).state;
          const live = s.cards.filter((c) => c.status === 'active' || c.status === 'telegraph');
          expect(live.length).toBeLessThanOrEqual(ctx.maxSlots);
          for (const a of live)
            for (const b of live) {
              if (a !== b) expect(conflicts(ctx.defs[a.idx]!, ctx.defs[b.idx]!)).toBe(false);
            }
        }
      }
    }
  });
});
