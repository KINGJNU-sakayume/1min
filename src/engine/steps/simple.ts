import type { Input, Judgment, SimpleLocal } from '../types';
import { done, same, type StepCtx, type StepOf, type StepUpdate } from './context';

/** openButton: 정각 판정 (game-rules §5) */
export const openButton = {
  init: (): SimpleLocal => ({ kind: 'openButton' }),
  input(
    _def: StepOf<'openButton'>,
    local: SimpleLocal,
    input: Input,
    ctx: StepCtx,
  ): StepUpdate<SimpleLocal> {
    if (!(input.action === 'open' || (input.action === 'tap' && input.target === 'step:open')))
      return same(local);
    if (ctx.tick < ctx.t0) {
      ctx.markEarly();
      ctx.lock(ctx.director.judgment.earlyLockTicks);
      ctx.stat('earlyPress');
      ctx.emit({ type: 'early' });
      return same(local);
    }
    const delta = ctx.tick - ctx.t0;
    const j = ctx.director.judgment;
    const judgment: Judgment = ctx.early
      ? 'EARLY'
      : delta < j.perfectTicks
        ? 'PERFECT'
        : delta < j.goodTicks
          ? 'GOOD'
          : delta < j.lateTicks
            ? 'LATE'
            : 'SLOW';
    ctx.judge(judgment, delta);
    return done(local);
  },
};

export const hold = {
  init: (): SimpleLocal => ({ kind: 'hold' }),
  input(def: StepOf<'hold'>, local: SimpleLocal, input: Input): StepUpdate<SimpleLocal> {
    const held = Number(input.value ?? '0');
    return input.action === 'hold' && input.target === 'step:hold' && held >= def.hold.ticks
      ? done(local)
      : same(local);
  },
};

export const confirm = {
  init: (): SimpleLocal => ({ kind: 'confirm' }),
  input(_def: StepOf<'confirm'>, local: SimpleLocal, input: Input): StepUpdate<SimpleLocal> {
    return input.action === 'tap' && input.target === 'step:confirm' ? done(local) : same(local);
  },
};
