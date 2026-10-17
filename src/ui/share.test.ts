import { describe, expect, it } from 'vitest';
import { copy, hasCopy } from '../content/copy';
import { playWithBot } from '../engine/bot/solver';
import { computeResult } from '../engine/result';
import { seedString } from '../engine/seed';
import { content, ctxFor } from '../engine/test-utils';
import { buildShareText, emojiTimeline, pickShareLine } from './share';

const spec = { stageId: 'ticketing', level: 4, code: 'K7M2Q' };

describe('공유 텍스트', () => {
  const ctx = ctxFor('ticketing', 4, 'K7M2Q');
  const result = computeResult(ctx, playWithBot(ctx, content().director.solver).state);
  const text = buildShareText({
    result,
    stage: ctx.stage,
    spec,
    seedString: seedString(spec),
    contentVersion: content().contentVersion,
    url: 'https://example.invalid/1min/?seed=x',
    copy,
    has: hasCopy,
  });

  it('형식: 머리·칭호·이모지·태그·링크, 카드 이름은 숨긴다', () => {
    const lines = text.split('\n');
    expect(lines[0]).toBe('1분 전 🎟️ 딱표 #K7M2Q');
    expect(lines[1]).toContain('초 남기고 성공');
    expect(lines[2]).toMatch(/^[🟩🟨🟥⬜]+ \(카드 \d+개 중 해결 \d+\)$/u);
    expect(text).toContain('#피켓팅');
    expect(lines.at(-1)).toContain('?seed=');
    for (const def of ctx.defs) expect(text).not.toContain(copy(`${def.copyKey}.title`));
  });

  it('이모지 수 = 뜬 카드 수', () => {
    expect([...emojiTimeline(result)].length).toBe(result.timeline.length);
  });

  it('공유 한 줄은 copy 스트림으로 결정적', () => {
    const a = pickShareLine('ticketing', 'ticketing|4|K7M2Q', copy, hasCopy);
    expect(a).toBe(pickShareLine('ticketing', 'ticketing|4|K7M2Q', copy, hasCopy));
    const seen = new Set(
      ['AAAAA', 'BBBBB', 'CCCCC', 'DDDDD', 'EEEEE', 'FFFFF'].map((c) =>
        pickShareLine('ticketing', `ticketing|4|${c}`, copy, hasCopy),
      ),
    );
    expect(seen.size).toBeGreaterThan(1);
  });
});
