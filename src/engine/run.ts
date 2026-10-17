import { playWithBot } from './bot/solver';
import { buildSchedule } from './director';
import { seedString, type SeedSpec } from './seed';
import type { CardDef, EngineContent, RunContext, RunOptions, Schedule, StageJson } from './types';

export function makeContext(
  content: EngineContent,
  stage: StageJson,
  level: number,
  schedule: Schedule,
  options: RunOptions,
): RunContext {
  const diff = stage.difficulty.find((d) => d.level === level);
  if (!diff) throw new Error(`난이도 ${level} 없음: ${stage.id}`);
  const defs = schedule.entries.map((e) => {
    const def = content.cards.get(e.cardId);
    if (!def) throw new Error(`카드 없음: ${e.cardId}`);
    return def;
  });
  const dir = content.director;
  return {
    content,
    stage,
    level,
    maxSlots: diff.maxSlots,
    schedule,
    defs: defs satisfies CardDef[],
    t0: stage.mode === 'open' ? dir.prerollTicks : 0,
    durationTicks: Math.round(
      stage.durationTicks * (options.assist ? dir.assistDurationFactor : 1),
    ),
    options,
  };
}

export interface RunSetup {
  ctx: RunContext;
  /** 솔버가 거부해 파생 시드로 넘어간 횟수 */
  retries: number;
  /** 솔버 봇이 이 스케줄을 성공했는가 (공정성, hazard-system §5.6) */
  verified: boolean;
}

/** 시드 → 검증된 판. 솔버가 실패하면 `#r{n}` 파생 시드로 재시도한다 (결정적). */
export function createRun(content: EngineContent, spec: SeedSpec, options: RunOptions): RunSetup {
  const stage = content.stages.get(spec.stageId);
  if (!stage) throw new Error(`스테이지 없음: ${spec.stageId}`);
  const dir = content.director;
  let last: RunContext | null = null;
  for (let retry = 0; retry <= dir.maxSeedRetries; retry++) {
    const schedule = buildSchedule(content, stage, spec.level, seedString(spec, retry));
    const ctx = makeContext(content, stage, spec.level, schedule, options);
    last = ctx;
    const plain = options.assist
      ? makeContext(content, stage, spec.level, schedule, { assist: false })
      : ctx;
    if (playWithBot(plain, dir.solver).state.outcome === 'success')
      return { ctx, retries: retry, verified: true };
  }
  if (!last) throw new Error('판 생성 실패');
  return { ctx: last, retries: dir.maxSeedRetries, verified: false };
}
