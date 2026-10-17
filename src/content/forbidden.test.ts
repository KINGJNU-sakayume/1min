import { describe, expect, it } from 'vitest';
import { buildMatchers, parseForbiddenList, scanText } from './forbidden';

describe('금지어 검사', () => {
  const matchers = buildMatchers(parseForbiddenList('# 주석\n가짜상표\nACME\n\n'));

  it('주석과 빈 줄을 무시한다', () => {
    expect(matchers.map((m) => m.word)).toEqual(['가짜상표', 'ACME']);
  });

  it('한글은 부분 일치', () => {
    expect(scanText('a', '오늘은 가짜상표에서 예매', matchers)).toHaveLength(1);
  });

  it('영문은 단어 경계 + 대소문자 무시', () => {
    expect(scanText('a', 'buy at acme now', matchers)).toHaveLength(1);
    expect(scanText('a', 'acmeish', matchers)).toHaveLength(0);
    expect(scanText('a', 'xACME', matchers)).toHaveLength(0);
  });

  it('줄 번호를 보고한다', () => {
    expect(scanText('f', 'ok\nok\nACME', matchers)[0]).toEqual({
      file: 'f',
      line: 3,
      word: 'ACME',
    });
  });
});
