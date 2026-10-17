import { loadContent } from '../content/load';
import type { Store } from './storage';

/** 스테이지 순서 = content/index.ts의 순서 (튜토리얼 → 티켓팅 → 수강신청) */
export function stageOrder(): string[] {
  return [...loadContent().engine.stages.keys()];
}

/** 스테이지 해금: 앞 스테이지를 1회 시도하면 열린다 (difficulty §1.4) */
export function isUnlocked(order: readonly string[], stageId: string, store: Store): boolean {
  const i = order.indexOf(stageId);
  if (i <= 0) return true;
  const prev = order[i - 1];
  return prev !== undefined && store.stage(prev).attempts > 0;
}
