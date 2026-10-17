import { fnv1a32 } from '../engine/hash';
import type { RunResult } from '../engine/result';
import { Rng, streamSeed } from '../engine/rng';
import type { SeedSpec } from '../engine/seed';
import type { StageJson } from '../engine/types';

type CopyFn = (key: string, vars?: Record<string, string | number>) => string;

/** 🟩 해결 · 🟨 늦게 해결 · 🟥 실패 · ⬜ 끝날 때 아직 떠 있음 (difficulty §3.2). 카드 내용은 숨긴다 */
export function emojiTimeline(result: RunResult): string {
  return [...result.timeline]
    .sort((a, b) => a.start - b.start)
    .map((t) =>
      t.status === 'failed' ? '🟥' : t.status === 'resolved' ? (t.late ? '🟨' : '🟩') : '⬜',
    )
    .join('');
}

/** 공유 한 줄: copy 스트림으로 고른다 (스케줄과 독립, hazard §6) */
export function pickShareLine(
  stageId: string,
  seedString: string,
  copy: CopyFn,
  has: (k: string) => boolean,
): string | null {
  const keys: string[] = [];
  for (let i = 1; has(`share.${stageId}.${i}`); i++) keys.push(`share.${stageId}.${i}`);
  if (keys.length === 0) return null;
  const rng = Rng.fromSeed(streamSeed(seedString, 'copy') ^ fnv1a32('share'));
  return copy(rng.pick(keys));
}

export function shareUrl(
  origin: string,
  base: string,
  seedString: string,
  contentVersion: string,
): string {
  return `${origin}${base}?seed=${encodeURIComponent(seedString)}&v=${contentVersion}`;
}

export function buildShareText(args: {
  result: RunResult;
  stage: StageJson;
  spec: SeedSpec;
  seedString: string;
  contentVersion: string;
  url: string;
  copy: CopyFn;
  has: (k: string) => boolean;
}): string {
  const { result, stage, spec, copy } = args;
  const grid = emojiTimeline(result);
  const ok = result.timeline.filter((t) => t.status === 'resolved').length;
  const title = copy(result.title);
  const lines = [
    copy('share.header', {
      emoji: copy(`stage.${stage.id}.emoji`),
      brand: copy(stage.brand.name),
      code: spec.code,
    }),
    result.outcome === 'success'
      ? copy('share.win', { title, s: (result.remainingTicks / 20).toFixed(1) })
      : copy('share.fail', { title }),
    grid
      ? `${grid} ${copy('share.cards', { n: result.timeline.length, ok })}`
      : copy('share.noCards'),
  ];
  const line = pickShareLine(stage.id, args.seedString, copy, args.has);
  if (line) lines.push(`"${line}"`);
  lines.push(
    stage.tutorial
      ? copy('share.tagsTutorial')
      : copy('share.tags', { level: copy(`ui.level.${spec.level}`) }),
  );
  lines.push(args.url);
  return lines.join('\n');
}

/** Web Share → 클립보드 → execCommand 순서 (스파이크 §4.3 ⑤) */
export async function shareOrCopy(
  text: string,
): Promise<'share' | 'clipboard' | 'execCommand' | 'failed'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'share';
    } catch (e) {
      // 사용자가 공유 시트를 닫으면 AbortError — 클립보드로 넘어간다
      console.info('share 실패, 클립보드 폴백', e);
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'clipboard';
    } catch (e) {
      console.info('clipboard 실패, execCommand 폴백', e);
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand('copy');
  ta.remove();
  return ok ? 'execCommand' : 'failed';
}
