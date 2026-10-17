import { describe, expect, it } from 'vitest';
import { playWithBot } from './bot/solver';
import { Rng } from './rng';
import { resultHash, simulate } from './replay';
import { codes, content, ctxFor } from './test-utils';
import type { Input } from './types';

describe('리플레이 (입력 로그 → 같은 결과 해시)', () => {
  it('100 시드: 봇 판의 입력 로그를 재생하면 해시가 같다', () => {
    for (const [i, code] of codes(100, 3).entries()) {
      const level = 1 + (i % 5);
      const ctx = ctxFor('ticketing', level, code);
      const live = playWithBot(ctx, content().director.solver);
      const replayed = simulate(ctx, live.inputs);
      expect(resultHash(replayed)).toBe(resultHash(live.state));
      // JSON 왕복(공유·저장)을 거쳐도 같다
      const roundTrip = JSON.parse(JSON.stringify(live.inputs)) as Input[];
      expect(resultHash(simulate(ctx, roundTrip))).toBe(resultHash(live.state));
    }
  });

  it('엉뚱한 입력(몽키)도 두 번 재생하면 같은 해시', () => {
    const targets = [
      'step:open',
      'step:refresh',
      'step:seat:a-A1',
      'step:zone:b',
      'step:confirm',
      'card:0:ok',
      'card:1:allow',
      'step:pay',
      'step:qty-plus',
      'card:2:opt:join',
    ];
    for (const code of codes(30, 11)) {
      const ctx = ctxFor('ticketing', 5, code);
      const r = Rng.fromSeed(code.charCodeAt(0) * 31 + code.charCodeAt(1));
      const inputs: Input[] = [{ tick: 0, action: 'start', target: 'run' }];
      for (let k = 0; k < 200; k++) {
        inputs.push({
          tick: r.int(0, ctx.t0 + 1200),
          action: r.pick(['tap', 'open', 'type'] as const),
          target: r.pick(targets),
          value: 'ABCDE',
        });
      }
      expect(resultHash(simulate(ctx, inputs))).toBe(resultHash(simulate(ctx, inputs)));
    }
  });

  it('입력이 다르면 해시가 달라진다', () => {
    const ctx = ctxFor('ticketing', 1, 'K7M2Q');
    const live = playWithBot(ctx, content().director.solver);
    const cut = live.inputs.slice(0, Math.floor(live.inputs.length / 2));
    expect(resultHash(simulate(ctx, cut))).not.toBe(resultHash(live.state));
  });
});
