import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * 엔진 결정론 규칙 (CLAUDE.md 절대 규칙 1·2).
 * src/engine/** 에서는 실제 시계·전역 난수·DOM/React를 쓸 수 없다.
 */
export const engineRules = {
  'no-restricted-properties': [
    'error',
    {
      object: 'Math',
      property: 'random',
      message: '엔진은 시드 PRNG 스트림만 쓴다 (src/engine/rng.ts).',
    },
    { object: 'Date', property: 'now', message: '엔진은 틱만 쓴다. 실제 시계 금지.' },
    { object: 'performance', property: 'now', message: '엔진은 틱만 쓴다. 실제 시계 금지.' },
  ],
  'no-restricted-syntax': [
    'error',
    { selector: "NewExpression[callee.name='Date']", message: '엔진에서 new Date() 금지.' },
    { selector: "CallExpression[callee.name='Date']", message: '엔진에서 Date() 금지.' },
  ],
  'no-restricted-globals': [
    'error',
    { name: 'window', message: '엔진은 DOM에 접근하지 않는다.' },
    { name: 'document', message: '엔진은 DOM에 접근하지 않는다.' },
    { name: 'localStorage', message: '엔진은 저장소에 접근하지 않는다.' },
    { name: 'requestAnimationFrame', message: '엔진은 렌더 루프와 분리된다.' },
    { name: 'setTimeout', message: '엔진은 틱만 쓴다.' },
    { name: 'setInterval', message: '엔진은 틱만 쓴다.' },
    { name: 'performance', message: '엔진은 틱만 쓴다.' },
  ],
  'no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
          message: '엔진은 React를 import하지 않는다.',
        },
        { group: ['**/ui/**', '@/ui/**'], message: '엔진은 UI 층을 import하지 않는다.' },
      ],
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'docs'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.tsx', 'src/ui/**/*.ts'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/engine/**/*.ts'],
    languageOptions: { globals: {} },
    rules: engineRules,
  },
);
