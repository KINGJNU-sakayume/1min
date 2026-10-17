import { hashHex } from './hash';
import type {
  CardDef,
  CardJson,
  DirectorJson,
  EngineContent,
  FixedScheduleJson,
  StageJson,
} from './types';

/** 밀리초 카드 데이터를 틱 단위 정의로 바꾼다 (결정 0003 #5·#6의 기본값 포함) */
export function compileCard(card: CardJson, director: DirectorJson): CardDef {
  const { telegraphMs, activeMs, cooldownMs, expire, ...rest } = card;
  const toTicks = (ms: number) => Math.round(ms / director.tickMs);
  return {
    ...rest,
    telegraphTicks: toTicks(telegraphMs),
    activeTicks: activeMs === null ? null : toTicks(activeMs),
    cooldownTicks: toTicks(cooldownMs ?? director.cooldownMsDefault),
    expire: expire ?? (card.counter === 'wait' || card.counter === 'ignore' ? 'resolve' : 'fail'),
  };
}

export function buildEngineContent(input: {
  director: DirectorJson;
  cards: readonly CardJson[];
  stages: readonly StageJson[];
  fixed: readonly FixedScheduleJson[];
}): EngineContent {
  const cards = new Map(input.cards.map((c) => [c.id, compileCard(c, input.director)] as const));
  const stages = new Map(input.stages.map((s) => [s.id, s] as const));
  const fixed = new Map(input.fixed.map((f) => [f.name, f] as const));
  const contentVersion = hashHex({
    director: input.director,
    cards: input.cards,
    stages: input.stages,
    fixed: input.fixed,
  }).slice(0, 6);
  return { director: input.director, cards, stages, fixed, contentVersion };
}

/** `tag:x` 또는 카드 ID로 상호배제를 판단한다 (양방향) */
export function conflicts(a: CardDef, b: CardDef): boolean {
  const hit = (from: CardDef, to: CardDef) =>
    (from.exclusiveWith ?? []).some((rule) =>
      rule.startsWith('tag:') ? to.tags.includes(rule.slice(4)) : rule === to.id,
    );
  return hit(a, b) || hit(b, a);
}

/** 카드가 이 스테이지 단계에 뜰 수 있는가 (window) */
export function windowMatches(def: CardDef, step: { id: string; kind: string }): boolean {
  const w = def.window;
  if (!w) return true;
  return (w.steps?.includes(step.id) ?? false) || (w.stepKinds?.includes(step.kind) ?? false);
}

/** 만료 시 자동으로 잠금·되돌림이 일어나는 카드 (텔레그래프 최소값 대상, 결정 0003 #4) */
export function isPunishingOnExpire(def: {
  expire: 'resolve' | 'fail';
  failEffect: { kind: string };
}): boolean {
  return def.expire === 'fail' && def.failEffect.kind !== 'none';
}
