/** 금지어 검사 (brand-and-tone §5, stage-format §3). 순수 함수 — 파일 I/O는 scripts/에서. */

export interface ForbiddenHit {
  file: string;
  line: number;
  word: string;
}

export function parseForbiddenList(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
}

const isAscii = (w: string) => /^[\x20-\x7e]+$/.test(w);
const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildMatchers(words: string[]): { word: string; re: RegExp }[] {
  return words.map((word) => ({
    word,
    // 영문은 단어 경계 + 대소문자 무시, 한글은 부분 일치
    re: isAscii(word)
      ? new RegExp(`(^|[^A-Za-z0-9])${escape(word)}(?![A-Za-z0-9])`, 'i')
      : new RegExp(escape(word)),
  }));
}

export function scanText(
  file: string,
  text: string,
  matchers: { word: string; re: RegExp }[],
): ForbiddenHit[] {
  const hits: ForbiddenHit[] = [];
  text.split('\n').forEach((lineText, i) => {
    for (const m of matchers) {
      if (m.re.test(lineText)) hits.push({ file, line: i + 1, word: m.word });
    }
  });
  return hits;
}
