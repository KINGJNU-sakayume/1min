/** 시드 문자열 `"{stageId}|{difficulty}|{code}"` (game-rules §11, hazard-system §6) */

/** 헷갈리는 글자(0 O 1 I L)를 뺀 공유 코드 알파벳 */
export const SEED_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_RE = new RegExp(`^[${SEED_CODE_ALPHABET}]{5,6}$`);

export interface SeedSpec {
  stageId: string;
  level: number;
  code: string;
}

export function isValidSeedCode(code: string): boolean {
  return CODE_RE.test(code);
}

export function normalizeSeedCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}

/** retry > 0 이면 솔버가 거부한 시드의 파생 시드 (`#r{n}`) */
export function seedString(spec: SeedSpec, retry = 0): string {
  const base = `${spec.stageId}|${spec.level}|${spec.code}`;
  return retry > 0 ? `${base}#r${retry}` : base;
}

export function parseSeedString(text: string): SeedSpec | null {
  const m = /^([a-z][a-z0-9-]*)\|([0-5])\|([0-9A-Z]{5,6})$/.exec(text.trim());
  if (!m) return null;
  const [, stageId, level, code] = m;
  if (!stageId || !level || !code || !isValidSeedCode(code)) return null;
  return { stageId, level: Number(level), code };
}
