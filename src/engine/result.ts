import { remainingTicks } from './reducer';
import type { CardStatus, Judgment, RunContext, RunState } from './types';
import type { ResultRule } from '../../content/schema/stage';

/** 결과 객체 (game-rules §8) + 결과 화면용 타임라인 */
export interface TimelineItem {
  idx: number;
  cardId: string;
  /** 판 시작(T0) 기준 틱 */
  start: number;
  end: number;
  status: Extract<CardStatus, 'resolved' | 'failed' | 'active' | 'telegraph' | 'skipped'>;
  late: boolean;
}

export interface RunResult {
  outcome: 'success' | 'fail';
  reason: string;
  remainingTicks: number;
  resolvedCards: number;
  failedCards: number;
  lateCards: number;
  synergies: string[];
  judgment: Judgment | null;
  stats: Record<string, number>;
  titleId: string;
  title: string;
  line?: string;
  stars: 0 | 1 | 2 | 3;
  timeline: TimelineItem[];
}

export function computeResult(ctx: RunContext, s: RunState): RunResult {
  if (s.phase !== 'RESULT' || !s.outcome || !s.reason) throw new Error('판이 끝나지 않았다');
  const end = s.finishedAt ?? s.tick;
  const timeline: TimelineItem[] = s.cards
    .filter((c) => c.telegraphAt !== null)
    .map((c) => ({
      idx: c.idx,
      cardId: ctx.defs[c.idx]?.id ?? '?',
      start: (c.telegraphAt ?? 0) - s.runStartTick,
      end: (c.finishedAt ?? end) - s.runStartTick,
      status: c.status as TimelineItem['status'],
      late: c.late,
    }));
  const base = {
    outcome: s.outcome,
    reason: s.reason,
    remainingTicks: Math.max(0, remainingTicks(ctx, s, end)),
    resolvedCards: timeline.filter((t) => t.status === 'resolved').length,
    failedCards: timeline.filter((t) => t.status === 'failed').length,
    lateCards: timeline.filter((t) => t.status === 'resolved' && t.late).length,
    synergies: [...s.synergies],
    judgment: s.judgment,
    stats: { ...s.stats },
    timeline,
  };
  const rule = ctx.stage.results.find((r) => ruleMatches(r, base, timeline));
  if (!rule) throw new Error(`결과 규칙 없음: ${ctx.stage.id}`);
  const dir = ctx.content.director;
  let stars: RunResult['stars'] = 0;
  if (base.outcome === 'success') {
    stars = 1;
    if (base.remainingTicks >= dir.stars.twoStarRemainingTicks) stars = 2;
    if (stars === 2 && base.failedCards === 0) stars = 3;
  }
  return {
    ...base,
    titleId: rule.id,
    title: rule.title,
    ...(rule.line ? { line: rule.line } : {}),
    stars,
  };
}

export function ruleMatches(
  rule: ResultRule,
  r: Pick<RunResult, 'outcome' | 'reason' | 'remainingTicks' | 'stats' | 'judgment'>,
  timeline: readonly TimelineItem[],
): boolean {
  const w = rule.when;
  if (w.outcome !== r.outcome) return false;
  if (w.reason !== undefined && w.reason !== r.reason) return false;
  if (w.remainingTicksLte !== undefined && r.remainingTicks > w.remainingTicksLte) return false;
  if (w.remainingTicksGte !== undefined && r.remainingTicks < w.remainingTicksGte) return false;
  if (w.judgment !== undefined && w.judgment !== r.judgment) return false;
  if (w.stat !== undefined && (r.stats[w.stat.name] ?? 0) < w.stat.gte) return false;
  if (w.failedCardIncludes !== undefined) {
    const n = timeline.filter(
      (t) => t.status === 'failed' && t.cardId === w.failedCardIncludes,
    ).length;
    if (n < (w.minCount ?? 1)) return false;
  }
  return true;
}
