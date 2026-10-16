import { describe, expect, it } from 'vitest';
import { rawContent } from '../../content';
import { parseContent } from '../content/load';
import { windowMatches } from './content';
import {
  activeStepsAt,
  buildSchedule,
  fitsGroup,
  nominalSpan,
  surfaceRunOk,
  type Placement,
} from './director';
import { seedString } from './seed';
import { codes, content, stageOf } from './test-utils';
import type { Schedule } from './types';

const ticketing = () => stageOf('ticketing');
const sched = (level: number, code: string) =>
  buildSchedule(content(), ticketing(), level, seedString({ stageId: 'ticketing', level, code }));
const brief = (s: Schedule) =>
  s.entries.map(
    (e) =>
      `${e.cardId}@${e.anchor.kind === 'run' ? e.anchor.tick : `${e.anchor.stepId}+${e.anchor.offset}`}`,
  );

describe('디렉터: 결정론', () => {
  it('같은 시드 → 같은 스케줄', () => {
    expect(sched(3, 'K7M2Q')).toEqual(sched(3, 'K7M2Q'));
  });

  it('다른 시드 → 대체로 다른 스케줄', () => {
    const set = new Set(codes(20).map((c) => JSON.stringify(brief(sched(3, c)))));
    expect(set.size).toBeGreaterThan(15);
  });

  it('골든 스냅샷 (밸런스를 바꾸면 의도적으로 갱신)', () => {
    expect({ l1: brief(sched(1, 'K7M2Q')), l5: brief(sched(5, 'K7M2Q')) }).toMatchSnapshot();
  });

  it('스트림 독립성: 문구를 바꿔도 contentVersion과 스케줄이 같다', () => {
    const altered = parseContent({
      ...rawContent,
      copy: {
        ...(rawContent.copy as Record<string, string>),
        'haz.captcha.body': '완전히 다른 문구',
      },
    });
    expect(altered.engine.contentVersion).toBe(content().contentVersion);
    const s = buildSchedule(altered.engine, ticketing(), 4, 'ticketing|4|K7M2Q');
    expect(s).toEqual(sched(4, 'K7M2Q'));
  });

  it('난이도 0은 고정 스케줄', () => {
    expect(brief(sched(0, 'AAAAA'))).toEqual(brief(sched(0, 'ZZZZZ')));
  });
});

describe('디렉터: 1,000 시드 퍼징 (hazard-system §5 규칙 위반 0)', () => {
  const stage = ticketing();
  const dir = content().director;
  const seeds = codes(200, 7);

  for (const level of [1, 2, 3, 4, 5]) {
    it(`난이도 ${level} × ${seeds.length} 시드`, () => {
      const diff = stage.difficulty[level]!;
      const steps = activeStepsAt(stage, level);
      const lastStart = Math.floor((stage.durationTicks * dir.lastStartPct) / 100);
      for (const code of seeds) {
        const s = sched(level, code);
        expect(s.spent).toBeLessThanOrEqual(diff.budget);
        const placements: Placement[] = s.entries.map((e) => {
          const def = content().cards.get(e.cardId)!;
          const start = e.anchor.kind === 'run' ? e.anchor.tick : e.anchor.offset;
          return {
            def,
            anchor: e.anchor,
            start,
            end: start + nominalSpan(def, content()),
            cost: def.cost,
          };
        });
        const groups = new Map<string, Placement[]>();
        for (const p of placements) {
          const key = p.anchor.kind === 'run' ? 'run' : p.anchor.stepId;
          expect(p.def.minDifficulty).toBeLessThanOrEqual(level);
          if (p.anchor.kind === 'run') {
            expect(p.def.window).toBeUndefined();
            expect(p.anchor.tick).toBeLessThan(lastStart);
          } else {
            const anchorStep = steps.find((x) => x.id === (p.anchor as { stepId: string }).stepId);
            expect(anchorStep, `${p.def.id} 기준 단계는 이 난이도에 존재`).toBeDefined();
            expect(windowMatches(p.def, anchorStep!)).toBe(true);
          }
          const group = groups.get(key) ?? [];
          // 이미 놓인 카드들과 슬롯·상호배제·쿨다운이 맞아야 한다 (순서 무관 재검증)
          expect(
            fitsGroup(p.def, p.start, p.end, group, diff.maxSlots),
            `${code} ${p.def.id}`,
          ).toBe(true);
          group.push(p);
          groups.set(key, group);
        }
        expect(surfaceRunOk(groups.get('run') ?? [], dir.maxSameSurfaceRun)).toBe(true);
        expect(
          placements.filter((p) => p.def.failEffect.kind === 'fatal').length,
        ).toBeLessThanOrEqual(1);
        const specific = placements.filter((p) => stage.deck.specific.includes(p.def.id)).length;
        expect(specific, `${code} 고유 카드 보장`).toBeGreaterThanOrEqual(
          stage.deck.mustInclude.specificMin,
        );
      }
    });
  }
});
