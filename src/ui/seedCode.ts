import { SEED_CODE_ALPHABET } from '../engine/seed';

/** 새 판 코드 (UI 전용 난수 — 엔진 밖이라 crypto 사용 가능) */
export function randomSeedCode(length = 5): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => SEED_CODE_ALPHABET[b % SEED_CODE_ALPHABET.length]).join('');
}
