import { fnv1a32 } from './hash';

/** 용도별 난수 스트림 (hazard-system §6). 문구·연출을 바꿔도 카드 스케줄이 변하지 않게 분리한다. */
export const STREAMS = ['director', 'layout', 'queue', 'copy', 'cosmetic'] as const;
export type StreamName = (typeof STREAMS)[number];

/** mulberry32 한 걸음. 상태는 uint32 정수라 엔진 상태에 그대로 직렬화된다. */
export function mulberry32(state: number): { value: number; state: number } {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: s >>> 0 };
}

export function streamSeed(seedString: string, stream: StreamName): number {
  return fnv1a32(`${seedString}::${stream}`);
}

/** 상태를 바깥(객체 필드 등)에 두는 난수 생성기 */
export class Rng {
  constructor(
    private readonly read: () => number,
    private readonly write: (state: number) => void,
  ) {}

  static fromSeed(seed: number): Rng {
    let s = seed >>> 0;
    return new Rng(
      () => s,
      (n) => {
        s = n;
      },
    );
  }

  /** [0, 1) */
  next(): number {
    const r = mulberry32(this.read());
    this.write(r.state);
    return r.value;
  }

  /** [min, max] 정수 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  range(r: { min: number; max: number }): number {
    return this.int(r.min, r.max);
  }

  /** [min, max) 실수 */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick: 빈 배열');
    return items[this.int(0, items.length - 1)] as T;
  }

  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    const total = items.reduce((sum, it) => sum + Math.max(0, weightOf(it)), 0);
    if (items.length === 0 || total <= 0) throw new Error('weighted: 후보 없음');
    let roll = this.next() * total;
    for (const it of items) {
      roll -= Math.max(0, weightOf(it));
      if (roll < 0) return it;
    }
    return items[items.length - 1] as T;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  code(length: number, alphabet: string): string {
    let s = '';
    for (let i = 0; i < length; i++) s += alphabet[this.int(0, alphabet.length - 1)];
    return s;
  }
}
