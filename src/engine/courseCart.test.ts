import { describe, expect, it } from 'vitest';
import { makeContext } from './run';
import { createInitialState, step } from './reducer';
import { content, stageOf } from './test-utils';
import type { CourseCartLocal, Input, RunContext, RunState, Schedule } from './types';

const tap = (tick: number, target: string): Input => ({ tick, action: 'tap', target });

function ctxWith(entries: Schedule['entries'] = [], level = 3): RunContext {
  const stage = stageOf('course-reg');
  return makeContext(
    content(),
    stage,
    level,
    {
      stageId: stage.id,
      level,
      seedString: `course-reg|${level}|CART2`,
      contentVersion: content().contentVersion,
      spent: 0,
      entries,
    },
    { assist: false },
  );
}

/** 로그인까지 마친 상태(정각 전, 장바구니 화면) */
function atCart(ctx: RunContext): RunState {
  let s = step(ctx, createInitialState(ctx), [{ tick: 0, action: 'start', target: 'run' }]).state;
  s = step(ctx, s, [tap(0, 'step:confirm')]).state;
  return s;
}

function advanceTo(ctx: RunContext, s: RunState, tick: number, inputs: Input[] = []): RunState {
  while (s.tick < tick && s.phase !== 'RESULT')
    s = step(
      ctx,
      s,
      inputs.filter((i) => i.tick === s.tick),
    ).state;
  return s;
}

const cart = (s: RunState): CourseCartLocal => {
  if (s.step.kind !== 'courseCart') throw new Error(`장바구니 아님: ${s.step.kind}`);
  return s.step;
};

describe('수강신청 결과 모델 (realism-spec §2.2)', () => {
  it('정각 전에도 로그인할 수 있고, 신청은 "기간이 아닙니다"', () => {
    const ctx = ctxWith();
    let s = atCart(ctx);
    expect(s.phase).toBe('PREROLL');
    s = step(ctx, s, [tap(s.tick, 'step:apply:ds')]).state;
    expect(cart(s).popup?.kind).toBe('notPeriod');
    expect(s.stats.notPeriodHits).toBe(1);
  });

  it('정각 뒤: pending → 지연 뒤 success, 학점 집계', () => {
    const ctx = ctxWith();
    let s = advanceTo(ctx, atCart(ctx), ctx.t0);
    s = step(ctx, s, [tap(s.tick, 'step:apply:ds')]).state;
    expect(cart(s).courses.ds?.status).toBe('pending');
    s = advanceTo(ctx, s, s.tick + 40);
    expect(cart(s).courses.ds?.status).toBe('success');
    expect(s.stats.creditsRegistered).toBe(3);
  });

  it('장바구니 인원 > 정원인 과목은 늦게 누르면 정원 초과', () => {
    const ctx = ctxWith();
    let s = advanceTo(ctx, atCart(ctx), ctx.t0 + 400);
    s = step(ctx, s, [tap(s.tick, 'step:apply:wine')]).state;
    s = advanceTo(ctx, s, s.tick + 40);
    expect(cart(s).courses.wine?.status).toBe('full');
    expect(cart(s).popup?.kind).toBe('full');
  });

  it('같은 시간표 칸은 함께 신청할 수 없다', () => {
    const ctx = ctxWith();
    let s = advanceTo(ctx, atCart(ctx), ctx.t0);
    s = step(ctx, s, [tap(s.tick, 'step:apply:wine')]).state;
    s = step(ctx, s, [tap(s.tick, 'step:apply:calculus')]).state;
    expect(cart(s).popup?.kind).toBe('overlap');
  });

  it('목표 과목 수 전에는 "신청 완료"가 통과되지 않는다', () => {
    const ctx = ctxWith();
    let s = advanceTo(ctx, atCart(ctx), ctx.t0);
    s = step(ctx, s, [tap(s.tick, 'step:done')]).state;
    expect(ctx.stage.steps[s.stepIndex]?.id).toBe('cart');
  });

  it('not-period-popup 카드: 정각 뒤에도 기간 아님이 이어진다', () => {
    const ctx = ctxWith([
      {
        idx: 0,
        cardId: 'course-reg.not-period-popup',
        anchor: { kind: 'step', stepId: 'cart', offset: 0 },
      },
    ]);
    let s = advanceTo(ctx, atCart(ctx), ctx.t0 + 5);
    s = step(ctx, s, [tap(s.tick, 'step:apply:ds')]).state;
    expect(cart(s).popup?.kind).toBe('notPeriod');
  });

  it('cart-ok-submit-blocked 카드: 다음 신청이 자격 오류로 막히고 계속 막힌다', () => {
    const ctx = ctxWith([
      {
        idx: 0,
        cardId: 'course-reg.cart-ok-submit-blocked',
        anchor: { kind: 'step', stepId: 'cart', offset: 0 },
      },
    ]);
    let s = advanceTo(ctx, atCart(ctx), ctx.t0 + 10);
    s = step(ctx, s, [tap(s.tick, 'step:apply:writing')]).state;
    expect(cart(s).courses.writing?.status).toBe('blocked');
    s = step(ctx, s, [tap(s.tick, 'step:popup-ok')]).state;
    s = step(ctx, s, [tap(s.tick, 'step:apply:writing')]).state;
    expect(cart(s).popup?.kind).toBe('blocked');
  });

  it('late-full 카드: 정원 여유가 있어도 오래 처리 중이다가 정원 초과', () => {
    const ctx = ctxWith([
      {
        idx: 0,
        cardId: 'course-reg.late-full',
        anchor: { kind: 'step', stepId: 'cart', offset: 0 },
      },
    ]);
    let s = advanceTo(ctx, atCart(ctx), ctx.t0 + 10);
    s = step(ctx, s, [tap(s.tick, 'step:apply:ds')]).state;
    const resolveAt = cart(s).courses.ds?.resolveAt ?? 0;
    expect(resolveAt - s.tick).toBeGreaterThanOrEqual(80);
    s = advanceTo(ctx, s, resolveAt + 1);
    expect(cart(s).courses.ds?.status).toBe('full');
  });
});
