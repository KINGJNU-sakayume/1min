import { hashHex } from './hash';
import { createInitialState, step } from './reducer';
import type { Input, RunContext, RunState } from './types';

/** 입력 로그 = 판의 전부 (game-rules §7): (seed, contentVersion, inputs[]) → 재현 */
export interface InputLog {
  seedString: string;
  contentVersion: string;
  level: number;
  stageId: string;
  assist: boolean;
  inputs: Input[];
}

export function simulate(ctx: RunContext, inputs: readonly Input[]): RunState {
  const byTick = new Map<number, Input[]>();
  for (const i of inputs) {
    if (i.action === 'start') continue;
    const list = byTick.get(i.tick) ?? [];
    list.push(i);
    byTick.set(i.tick, list);
  }
  let state = createInitialState(ctx);
  const start = inputs.find((i) => i.action === 'start');
  if (!start) return state;
  state = step(ctx, state, [start]).state;
  const limit = ctx.t0 + ctx.durationTicks + 1;
  while (state.phase !== 'RESULT' && state.tick <= limit) {
    state = step(ctx, state, byTick.get(state.tick) ?? []).state;
  }
  return state;
}

/** 결과 해시: 같은 입력 로그면 같아야 한다 */
export function resultHash(state: RunState): string {
  return hashHex({
    phase: state.phase,
    tick: state.tick,
    outcome: state.outcome,
    reason: state.reason,
    finishedAt: state.finishedAt,
    stepIndex: state.stepIndex,
    judgment: state.judgment,
    penalty: state.penaltyTicks,
    stats: state.stats,
    synergies: state.synergies,
    cards: state.cards.map((c) => [c.status, c.telegraphAt, c.activeAt, c.finishedAt, c.late]),
    rng: state.rng,
  });
}
