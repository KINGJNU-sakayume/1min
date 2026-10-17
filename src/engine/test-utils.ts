import { loadContent } from '../content/load';
import { buildSchedule } from './director';
import { makeContext } from './run';
import { seedString, SEED_CODE_ALPHABET } from './seed';
import type { RunContext, StageJson } from './types';

/** 테스트 전용: 실제 콘텐츠로 판 컨텍스트를 만든다 */
export const content = () => loadContent().engine;

export function stageOf(id: string): StageJson {
  const stage = content().stages.get(id);
  if (!stage) throw new Error(`스테이지 없음: ${id}`);
  return stage;
}

export function ctxFor(stageId: string, level: number, code: string, assist = false): RunContext {
  const stage = stageOf(stageId);
  const ss = seedString({ stageId, level, code });
  return makeContext(content(), stage, level, buildSchedule(content(), stage, level, ss), {
    assist,
  });
}

/** 결정적인 테스트 시드 코드 n개 */
export function codes(n: number, salt = 0): string[] {
  const out: string[] = [];
  let x = 0x2545f491 ^ salt;
  for (let i = 0; i < n; i++) {
    let code = '';
    for (let k = 0; k < 5; k++) {
      x = (Math.imul(x, 1103515245) + 12345) >>> 0;
      code += SEED_CODE_ALPHABET[(x >>> 16) % SEED_CODE_ALPHABET.length];
    }
    out.push(code);
  }
  return out;
}
