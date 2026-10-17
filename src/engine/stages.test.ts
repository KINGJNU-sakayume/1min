import { describe, expect, it } from 'vitest';
import { loadContent } from '../content/load';
import { playWithBot } from './bot/solver';
import { windowMatches } from './content';
import {
  activeStepsAt,
  buildSchedule,
  fitsGroup,
  nominalSpan,
  surfaceRunOk,
  type Placement,
} from './director';
import { resultHash, simulate } from './replay';
import { createRun } from './run';
import { seedString } from './seed';
import { codes, content } from './test-utils';

/**
 * 모든 (튜토리얼이 아닌) 스테이지에 같은 검증을 돌린다 — 새 스테이지는 데이터만 추가하면 여기서 검사된다.
 * stage-format §10.9: 난이도 1~5 샘플 시드에서 솔버 봇 성공.
 */
const stages = [...loadContent().engine.stages.values()].filter((s) => !s.tutorial);

describe.each(stages.map((s) => [s.id, s] as const))('스테이지 %s', (stageId, stage) => {
  const dir = content().director;

  it('디렉터 퍼징: 5 난이도 × 120 시드 규칙 위반 0', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      const diff = stage.difficulty[level]!;
      const steps = activeStepsAt(stage, level);
      for (const code of codes(120, level * 31)) {
        const s = buildSchedule(content(), stage, level, seedString({ stageId, level, code }));
        expect(s.spent).toBeLessThanOrEqual(diff.budget);
        const groups = new Map<string, Placement[]>();
        for (const e of s.entries) {
          const def = content().cards.get(e.cardId)!;
          const start = e.anchor.kind === 'run' ? e.anchor.tick : e.anchor.offset;
          const p: Placement = {
            def,
            anchor: e.anchor,
            start,
            end: start + nominalSpan(def, content()),
            cost: def.cost,
          };
          if (e.anchor.kind === 'step') {
            const anchorId = e.anchor.stepId;
            expect(
              windowMatches(
                def,
                steps.find((x) => x.id === anchorId)!,
              ),
            ).toBe(true);
          }
          const key = e.anchor.kind === 'run' ? 'run' : e.anchor.stepId;
          const group = groups.get(key) ?? [];
          expect(fitsGroup(def, p.start, p.end, group, diff.maxSlots)).toBe(true);
          group.push(p);
          groups.set(key, group);
        }
        expect(surfaceRunOk(groups.get('run') ?? [], dir.maxSameSurfaceRun)).toBe(true);
        const specific = s.entries.filter((e) => stage.deck.specific.includes(e.cardId)).length;
        expect(specific).toBeGreaterThanOrEqual(stage.deck.mustInclude.specificMin);
      }
    }
  });

  it('솔버 봇: 5 난이도 × 120 시드 모두 검증된 판, 거부율 < 50%', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      let rejected = 0;
      for (const code of codes(120, level * 17 + 5)) {
        const setup = createRun(content(), { stageId, level, code }, { assist: false });
        expect(setup.verified, `${stageId}|${level}|${code}`).toBe(true);
        if (setup.retries > 0) rejected++;
      }
      expect(rejected / 120, `난이도 ${level} 거부율`).toBeLessThan(0.5);
    }
  });

  it('난이도 0 고정 스케줄도 솔버가 성공', () => {
    const setup = createRun(content(), { stageId, level: 0, code: 'K7M2Q' }, { assist: false });
    expect(playWithBot(setup.ctx, dir.solver).state.outcome).toBe('success');
  });

  it('리플레이: 50 시드 해시 일치', () => {
    for (const [i, code] of codes(50, 77).entries()) {
      const setup = createRun(content(), { stageId, level: 1 + (i % 5), code }, { assist: false });
      const live = playWithBot(setup.ctx, dir.solver);
      expect(resultHash(simulate(setup.ctx, live.inputs))).toBe(resultHash(live.state));
    }
  });
});
