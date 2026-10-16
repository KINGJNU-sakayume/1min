import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// 엔진 결정론 규칙이 실제로 ESLint에서 오류를 내는지 확인한다 (CI 게이트의 테스트).
const lint = async (code: string) => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText(code, { filePath: 'src/engine/__fixture__.ts' });
  return (result?.messages ?? []).map((m) => m.ruleId);
};

describe('엔진 금지 규칙', () => {
  it.each([
    ['Math.random', 'export const x = Math.random();', 'no-restricted-properties'],
    ['Date.now', 'export const x = Date.now();', 'no-restricted-properties'],
    ['performance.now', 'export const x = performance.now();', 'no-restricted-properties'],
    ['new Date', 'export const x = new Date();', 'no-restricted-syntax'],
    [
      'react import',
      "import { useState } from 'react';\nexport const x = useState;",
      'no-restricted-imports',
    ],
    ['window', 'export const x = window.innerWidth;', 'no-restricted-globals'],
  ])('%s 사용은 린트 오류', async (_name, code, rule) => {
    expect(await lint(code)).toContain(rule);
  });

  it('순수 코드는 통과', async () => {
    expect(await lint('export const add = (a: number, b: number): number => a + b;\n')).toEqual([]);
  });
});
