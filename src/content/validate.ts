import { COPY_REF_PREFIX } from '../../content/schema/copy';
import { isPunishingOnExpire } from '../engine/content';
import { ContentError, parseContent, type ParsedContent } from './load';

/**
 * 스키마 밖의 교차 검증 (stage-format §10). 빈 배열이면 통과.
 * 솔버 봇 통과(§10.9)와 튜토리얼 봇(§10.10)은 Vitest에서 검사한다.
 */
export function crossValidate(c: ParsedContent): string[] {
  const errors: string[] = [];
  const { engine, copy } = c;
  const dir = engine.director;
  const hasCopy = (key: string) => key in copy;

  const collectRefs = (value: unknown, out: string[] = []): string[] => {
    if (typeof value === 'string' && value.startsWith(COPY_REF_PREFIX))
      out.push(value.slice(COPY_REF_PREFIX.length));
    else if (Array.isArray(value)) value.forEach((v) => collectRefs(v, out));
    else if (value && typeof value === 'object')
      Object.values(value).forEach((v) => collectRefs(v, out));
    return out;
  };

  const ids = new Set<string>();
  for (const card of c.cards) {
    if (ids.has(card.id)) errors.push(`카드 ID 중복: ${card.id}`);
    ids.add(card.id);
    for (const suffix of ['title', 'body']) {
      if (!hasCopy(`${card.copyKey}.${suffix}`))
        errors.push(`${card.id}: 문구 없음 ${card.copyKey}.${suffix}`);
    }
    for (const key of collectRefs(card))
      if (!hasCopy(key)) errors.push(`${card.id}: 문구 없음 ${key}`);
    if (
      card.resolve.kind === 'tap' ||
      card.resolve.kind === 'hold' ||
      card.resolve.kind === 'avoid'
    ) {
      const part = card.resolve.target;
      if (!part.startsWith('step') && !hasCopy(`${card.copyKey}.${camel(part)}`) && part !== 'ok') {
        errors.push(`${card.id}: 버튼 문구 없음 ${card.copyKey}.${camel(part)}`);
      }
    }
    const def = engine.cards.get(card.id);
    if (def && isPunishingOnExpire(def) && card.telegraphMs < dir.telegraphMinMsForPunishing) {
      errors.push(
        `${card.id}: 만료 시 잠금·되돌림 카드는 telegraphMs ≥ ${dir.telegraphMinMsForPunishing}`,
      );
    }
  }

  for (const { file, stage } of c.stageFiles) {
    const where = `stages/${file}`;
    if (file !== `${stage.id}.stage.json`) errors.push(`${where}: id(${stage.id})와 파일명 불일치`);
    const stepIds = stage.steps.map((s) => s.id);
    if (new Set(stepIds).size !== stepIds.length) errors.push(`${where}: 단계 id 중복`);
    for (const id of [...stage.deck.common, ...stage.deck.specific]) {
      const card = engine.cards.get(id);
      if (!card) errors.push(`${where}: 덱 카드 없음 ${id}`);
      else if (card.stages !== '*' && !card.stages.includes(stage.id))
        errors.push(`${where}: ${id}는 이 스테이지용이 아님`);
    }
    for (const id of stage.deck.specific) {
      if (!id.startsWith(`${stage.id}.`))
        errors.push(`${where}: 고유 카드 접두가 스테이지 id가 아님 ${id}`);
    }
    if (!stage.tutorial && stage.deck.specific.length < 5)
      errors.push(`${where}: 고유 카드 5개 이상 필요`);
    const last = stage.results[stage.results.length - 1];
    if (!last || Object.keys(last.when).length !== 1)
      errors.push(`${where}: results 마지막은 outcome만 있는 기본값`);
    for (const outcome of ['success', 'fail'] as const) {
      if (
        !stage.results.some((r) => r.when.outcome === outcome && Object.keys(r.when).length === 1)
      ) {
        errors.push(`${where}: ${outcome} 기본 칭호 없음`);
      }
    }
    if (stage.tutorial) {
      if (stage.difficulty.length !== 1 || stage.difficulty[0]?.level !== 0) {
        errors.push(`${where}: 튜토리얼은 난이도 0 하나만`);
      }
      // 튜토리얼은 해결 방법을 화면에 직접 안내한다 (game-rules §10)
      for (const step of stage.steps) {
        if (!hasCopy(`tutorial.hint.${step.id}`))
          errors.push(`${where}: 안내 문구 없음 tutorial.hint.${step.id}`);
      }
      const fixedName = stage.difficulty[0]?.fixedSchedule;
      for (const e of (fixedName ? engine.fixed.get(fixedName)?.entries : undefined) ?? []) {
        if (!hasCopy(`tutorial.hint.card.${e.card}`))
          errors.push(`${where}: 안내 문구 없음 tutorial.hint.card.${e.card}`);
      }
    } else {
      if (stage.difficulty.length !== 6) errors.push(`${where}: difficulty는 6개`);
      stage.difficulty.forEach((d, i) => {
        if (d.level !== i) errors.push(`${where}: difficulty[${i}].level`);
        const prev = stage.difficulty[i - 1];
        if (i >= 2 && prev && d.budget <= prev.budget)
          errors.push(`${where}: 예산은 1~5에서 단조 증가`);
      });
    }
    for (const d of stage.difficulty) {
      if (d.fixedSchedule && !engine.fixed.has(d.fixedSchedule))
        errors.push(`${where}: 고정 스케줄 없음 ${d.fixedSchedule}`);
    }
    for (const step of stage.steps) {
      if (
        step.onTimeout?.kind === 'resetStep' &&
        step.onTimeout.to &&
        !stepIds.includes(step.onTimeout.to)
      ) {
        errors.push(`${where}: onTimeout 대상 단계 없음 ${step.onTimeout.to}`);
      }
    }
    for (const id of stage.deck.specific) {
      const card = engine.cards.get(id);
      for (const s of card?.window?.steps ?? []) {
        if (!stepIds.includes(s)) errors.push(`${where}: ${id}의 window 단계 없음 ${s}`);
      }
      if (
        card?.failEffect.kind === 'resetStep' &&
        card.failEffect.to &&
        !stepIds.includes(card.failEffect.to)
      ) {
        errors.push(`${where}: ${id}의 resetStep 대상 없음 ${card.failEffect.to}`);
      }
    }
    for (const key of collectRefs(stage))
      if (!hasCopy(key)) errors.push(`${where}: 문구 없음 ${key}`);
    if (stage.evidence.length === 0) errors.push(`${where}: evidence 없음`);
    if (!c.themes.has(stage.theme.tokens)) errors.push(`${where}: 테마 없음 ${stage.theme.tokens}`);
  }

  for (const { file, fixed } of c.fixedFiles) {
    if (file !== `${fixed.name}.json`) errors.push(`fixed/${file}: name 불일치`);
    for (const e of fixed.entries)
      if (!engine.cards.has(e.card)) errors.push(`fixed/${file}: 카드 없음 ${e.card}`);
  }
  return errors;
}

/** 모든 콘텐츠를 파싱·교차 검증하고 오류 목록을 돌려준다 */
export function validateAllContent(): string[] {
  try {
    return crossValidate(parseContent());
  } catch (e) {
    if (e instanceof ContentError) return e.issues;
    throw e;
  }
}

function camel(part: string): string {
  return part.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}
