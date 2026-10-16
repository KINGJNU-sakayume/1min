import type { Rng } from '../rng';
import type { DirectorJson, EngineEvent, Input, Judgment, StepJson, StepLocal } from '../types';

/** 단계 핸들러가 엔진에 요청할 수 있는 것 (엔진 초안 상태를 감싼다) */
export interface StepCtx {
  readonly tick: number;
  readonly level: number;
  readonly t0: number;
  readonly runEndTick: number;
  readonly judgment: Judgment | null;
  readonly early: boolean;
  readonly director: DirectorJson;
  readonly layout: Rng;
  readonly queue: Rng;
  stat(name: string, delta?: number): void;
  emit(event: EngineEvent): void;
  lock(ticks: number): void;
  judge(judgment: Judgment, delta: number): void;
  markEarly(): void;
}

export type StepOf<K extends StepJson['kind']> = Extract<StepJson, { kind: K }>;
export type LocalOf<K extends StepLocal['kind']> = Extract<StepLocal, { kind: K }>;

export interface StepUpdate<L> {
  local: L;
  done: boolean;
}

export const same = <L>(local: L): StepUpdate<L> => ({ local, done: false });
export const done = <L>(local: L): StepUpdate<L> => ({ local, done: true });

/** `step:seat:A-1` → ['seat', 'A-1'] */
export function stepParts(input: Input): string[] {
  return input.target.split(':').slice(1);
}
