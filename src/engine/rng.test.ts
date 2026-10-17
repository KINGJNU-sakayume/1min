import { describe, expect, it } from 'vitest';
import { fnv1a32, hashHex, stableStringify } from './hash';
import { mulberry32, Rng, streamSeed } from './rng';
import { isValidSeedCode, parseSeedString, seedString } from './seed';

describe('해시', () => {
  it('FNV-1a 골든 값', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('stableStringify는 키 순서와 무관', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(
      stableStringify({ a: [1, { c: 3, d: 2 }], b: 1 }),
    );
    expect(hashHex({ x: 1 })).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('mulberry32', () => {
  it('같은 상태 → 같은 수열 (골든)', () => {
    const r = Rng.fromSeed(12345);
    const seq = Array.from({ length: 5 }, () => r.next().toFixed(8));
    expect(seq).toMatchInlineSnapshot(`
      [
        "0.97972827",
        "0.30675226",
        "0.48420542",
        "0.81793441",
        "0.50942837",
      ]
    `);
  });

  it('상태는 uint32이고 순수 함수다', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a).toEqual(b);
    expect(Number.isInteger(a.state) && a.state >= 0 && a.state < 2 ** 32).toBe(true);
  });

  it('int는 경계를 포함하고 분포가 고르다', () => {
    const r = Rng.fromSeed(7);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) counts[r.int(0, 3)]! += 1;
    for (const c of counts) expect(c).toBeGreaterThan(850);
  });

  it('스트림 시드는 서로 다르다', () => {
    const s = 'ticketing|1|K7M2Q';
    const seeds = new Set(
      (['director', 'layout', 'queue', 'copy', 'cosmetic'] as const).map((n) => streamSeed(s, n)),
    );
    expect(seeds.size).toBe(5);
  });
});

describe('시드 문자열', () => {
  it('형식과 파생 시드', () => {
    const spec = { stageId: 'ticketing', level: 3, code: 'K7M2Q' };
    expect(seedString(spec)).toBe('ticketing|3|K7M2Q');
    expect(seedString(spec, 2)).toBe('ticketing|3|K7M2Q#r2');
    expect(parseSeedString('ticketing|3|K7M2Q')).toEqual(spec);
    expect(parseSeedString('ticketing|9|K7M2Q')).toBeNull();
  });

  it('공유 코드는 헷갈리는 글자를 쓰지 않는다', () => {
    expect(isValidSeedCode('K7M2Q')).toBe(true);
    expect(isValidSeedCode('K7M2O')).toBe(false);
    expect(isValidSeedCode('ABC')).toBe(false);
  });
});
