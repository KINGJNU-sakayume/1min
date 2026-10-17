import { conflicts, windowMatches } from './content';
import { fnv1a32 } from './hash';
import { Rng, streamSeed } from './rng';
import type { Anchor, CardDef, EngineContent, Schedule, ScheduleEntry, StageJson } from './types';

/**
 * 디렉터 (hazard-system §5): 시드와 난이도 예산으로 카드 스케줄을 판 시작 전에 전부 계산한다.
 * - window가 없는 카드는 판 시작 기준 틱에, 램프 가중치를 따라 배치한다.
 * - window가 있는 카드는 해당 단계 진입 후 offset 틱에 뜬다 (결정 0003 #18).
 * 결과는 불변 데이터이고 엔진은 읽기만 한다.
 */

export interface Placement {
  def: CardDef;
  anchor: Anchor;
  /** 같은 기준(판 또는 단계) 안에서의 시작·종료 틱 (배치 계산용 추정) */
  start: number;
  end: number;
  cost: number;
}

/** 배치 계산에 쓰는 카드 점유 길이 (activeMs가 null이면 추정값) */
export function nominalSpan(def: CardDef, content: EngineContent): number {
  const nominal = Math.round(content.director.nominalActiveMs / content.director.tickMs);
  return def.telegraphTicks + (def.activeTicks ?? nominal);
}

export function activeStepsAt(stage: StageJson, level: number) {
  return stage.steps.filter(
    (s) => !(s.skippableAtLevel !== undefined && level <= s.skippableAtLevel),
  );
}

export function eligibleCards(content: EngineContent, stage: StageJson, level: number): CardDef[] {
  const steps = activeStepsAt(stage, level);
  return [...stage.deck.common, ...stage.deck.specific]
    .map((id) => content.cards.get(id))
    .filter((def): def is CardDef => def !== undefined)
    .filter((def) => def.stages === '*' || def.stages.includes(stage.id))
    .filter((def) => def.minDifficulty <= level)
    .filter((def) => !def.window || steps.some((s) => windowMatches(def, s)));
}

function anchorKey(a: Anchor): string {
  return a.kind === 'run' ? 'run' : `step:${a.stepId}`;
}

/** 같은 기준 그룹 안에서 슬롯·상호배제·쿨다운을 지키는가 */
export function fitsGroup(
  def: CardDef,
  start: number,
  end: number,
  group: readonly Placement[],
  maxSlots: number,
): boolean {
  const overlapping = group.filter((p) => p.start < end && start < p.end);
  const points = [start, ...overlapping.map((p) => p.start).filter((s) => s > start && s < end)];
  for (const pt of points) {
    const concurrent = 1 + group.filter((p) => p.start <= pt && pt < p.end).length;
    if (concurrent > maxSlots) return false;
  }
  if (overlapping.some((p) => conflicts(def, p.def))) return false;
  for (const p of group) {
    if (
      p.def.id === def.id &&
      Math.abs(p.start - start) < Math.max(def.cooldownTicks, end - start)
    ) {
      return false;
    }
  }
  return true;
}

/** 같은 surface가 maxRun개를 넘어 연속하지 않는가 (판 기준 카드 순서) */
export function surfaceRunOk(placements: readonly Placement[], maxRun: number): boolean {
  const sorted = [...placements].sort((a, b) => a.start - b.start);
  let run = 0;
  let prev = '';
  for (const p of sorted) {
    run = p.def.surface === prev ? run + 1 : 1;
    prev = p.def.surface;
    if (run > maxRun) return false;
  }
  return true;
}

function synergyBonus(def: CardDef, overlapping: readonly Placement[]): number {
  let bonus = 0;
  for (const p of overlapping) {
    for (const s of def.synergyWith ?? []) if (p.def.tags.includes(s.tag)) bonus += s.bonusCost;
    for (const s of p.def.synergyWith ?? []) if (def.tags.includes(s.tag)) bonus += s.bonusCost;
  }
  return bonus;
}

export function buildSchedule(
  content: EngineContent,
  stage: StageJson,
  level: number,
  seedStr: string,
): Schedule {
  const diff = stage.difficulty.find((d) => d.level === level);
  if (!diff) throw new Error(`난이도 ${level} 없음: ${stage.id}`);
  const dir = content.director;
  const rng = Rng.fromSeed(streamSeed(seedStr, 'director'));
  // 카드 내용물(코드·선택지 순서)은 layout 스트림의 하위 스트림 — 런타임 layout과 섞이지 않게
  const payloadRng = Rng.fromSeed(fnv1a32(`${seedStr}::layout::cards`));

  const placed: Placement[] = [];
  let spent = 0;

  if (diff.fixedSchedule) {
    const fixed = content.fixed.get(diff.fixedSchedule);
    if (!fixed) throw new Error(`고정 스케줄 없음: ${diff.fixedSchedule}`);
    const entries = fixed.entries.map((e, idx) => {
      const def = content.cards.get(e.card);
      if (!def) throw new Error(`카드 없음: ${e.card}`);
      spent += def.cost;
      return withPayload(
        { idx, cardId: def.id, anchor: { kind: 'run', tick: e.startTick } },
        def,
        payloadRng,
        e.code,
      );
    });
    return {
      stageId: stage.id,
      level,
      seedString: seedStr,
      contentVersion: content.contentVersion,
      spent,
      entries,
    };
  }

  const steps = activeStepsAt(stage, level);
  const eligible = eligibleCards(content, stage, level);
  const weightOf = (def: CardDef) => stage.deck.weightOverrides?.[def.id] ?? def.weight;
  const specific = new Set(stage.deck.specific);
  const D = stage.durationTicks;
  const lastStart = Math.floor((D * dir.lastStartPct) / 100);
  let prev = 0;
  const segments = dir.ramp
    .map((r) => {
      const seg = {
        from: prev,
        to: Math.min(lastStart, Math.round((D * r.untilPct) / 100)),
        weight: r.weight,
      };
      prev = Math.max(prev, seg.to);
      return seg;
    })
    .filter((s) => s.to > s.from && s.weight > 0);

  const tryPlace = (def: CardDef): boolean => {
    let anchor: Anchor;
    let start: number;
    if (def.window) {
      const candidates = steps.filter((s) => windowMatches(def, s));
      if (candidates.length === 0) return false;
      const step = rng.pick(candidates);
      start = rng.range(dir.stepAnchorOffsetTicks);
      anchor = { kind: 'step', stepId: step.id, offset: start };
    } else {
      if (segments.length === 0) return false;
      const seg = rng.weighted(segments, (s) => s.weight);
      start = rng.int(seg.from, seg.to - 1);
      anchor = { kind: 'run', tick: start };
    }
    const end = start + nominalSpan(def, content);
    const key = anchorKey(anchor);
    const group = placed.filter((p) => anchorKey(p.anchor) === key);
    if (!fitsGroup(def, start, end, group, diff.maxSlots)) return false;
    if (def.failEffect.kind === 'fatal' && placed.some((p) => p.def.failEffect.kind === 'fatal'))
      return false;
    const overlapping = group.filter((p) => p.start < end && start < p.end);
    const cost = def.cost + synergyBonus(def, overlapping);
    if (spent + cost > diff.budget) return false;
    const candidate: Placement = { def, anchor, start, end, cost };
    if (anchor.kind === 'run' && !surfaceRunOk([...group, candidate], dir.maxSameSurfaceRun))
      return false;
    placed.push(candidate);
    spent += cost;
    return true;
  };

  // 1) 스토리 보장: 스테이지 고유 카드 최소 개수
  for (let k = 0; k < stage.deck.mustInclude.specificMin; k++) {
    for (let attempt = 0; attempt < dir.placementAttempts; attempt++) {
      const pool = eligible.filter((d) => specific.has(d.id) && spent + d.cost <= diff.budget);
      if (pool.length === 0) break;
      if (tryPlace(rng.weighted(pool, weightOf))) break;
    }
  }

  // 2) 예산이 남는 동안 가중치 추첨으로 채운다
  let misses = 0;
  while (misses < dir.placementAttempts) {
    const pool = eligible.filter((d) => spent + d.cost <= diff.budget);
    if (pool.length === 0) break;
    misses = tryPlace(rng.weighted(pool, weightOf)) ? 0 : misses + 1;
  }

  const stepOrder = new Map(stage.steps.map((s, i) => [s.id, i] as const));
  const sortKey = (p: Placement) =>
    p.anchor.kind === 'run'
      ? [0, p.anchor.tick]
      : [1 + (stepOrder.get(p.anchor.stepId) ?? 0), p.anchor.offset];
  const sorted = [...placed].sort((a, b) => {
    const [a0, a1] = sortKey(a);
    const [b0, b1] = sortKey(b);
    return a0! - b0! || a1! - b1!;
  });
  const entries = sorted.map((p, idx) =>
    withPayload({ idx, cardId: p.def.id, anchor: p.anchor }, p.def, payloadRng),
  );
  return {
    stageId: stage.id,
    level,
    seedString: seedStr,
    contentVersion: content.contentVersion,
    spent,
    entries,
  };
}

function withPayload(
  entry: ScheduleEntry,
  def: CardDef,
  rng: Rng,
  fixedCode?: string,
): ScheduleEntry {
  const out: ScheduleEntry = { ...entry };
  if (def.effect.code)
    out.code = fixedCode ?? rng.code(def.effect.code.length, def.effect.code.alphabet);
  if (def.resolve.kind === 'choose')
    out.optionOrder = rng.shuffle(def.resolve.options.map((o) => o.id));
  return out;
}
