import type { Input, QueueLocal } from '../types';
import { done, same, type StepCtx, type StepOf, type StepUpdate } from './context';

/** 대기열 (realism-spec §1.2): 판정으로 시작 인원, 구간마다 빨라졌다 멈추며 결정적으로 감소 */
export const queue = {
  init(def: StepOf<'queue'>, ctx: StepCtx): QueueLocal {
    const q = def.queue;
    const j = ctx.judgment ?? 'SLOW';
    const wobble = 1 + q.jitter * (2 * ctx.queue.next() - 1);
    const initial = Math.max(1, Math.round(q.base * q.factors[j] * wobble));
    return {
      kind: 'queue',
      count: initial,
      initial,
      baseRate: initial / q.waitTicks[j],
      rate: 0,
      segmentLeft: 0,
    };
  },

  tick(def: StepOf<'queue'>, local: QueueLocal, ctx: StepCtx): StepUpdate<QueueLocal> {
    const q = def.queue;
    let { rate, segmentLeft } = local;
    if (segmentLeft <= 0) {
      rate = ctx.queue.chance(q.pauseChance)
        ? 0
        : local.baseRate * ctx.queue.float(q.rateJitter.min, q.rateJitter.max);
      segmentLeft = q.segmentTicks;
    }
    const count = Math.max(0, local.count - rate);
    const next = { ...local, rate, segmentLeft: segmentLeft - 1, count };
    return count <= 0 ? done(next) : same(next);
  },

  input(
    def: StepOf<'queue'>,
    local: QueueLocal,
    input: Input,
    ctx: StepCtx,
  ): StepUpdate<QueueLocal> {
    if (input.action === 'tap' && input.target === 'step:refresh') {
      ctx.stat('queueResets');
      ctx.emit({ type: 'notice', key: 'queue.reset' });
      return same(queue.back(def, { ...local, count: 0 }, def.queue.resetTo));
    }
    return same(local);
  },

  /** 맨 뒤로 밀림 (새로고침, queueBack 실패 효과) */
  back(def: StepOf<'queue'>, local: QueueLocal, amount: number): QueueLocal {
    const count = local.count + amount;
    return { ...local, count, baseRate: count / def.queue.resetWaitTicks, segmentLeft: 0 };
  },
};
