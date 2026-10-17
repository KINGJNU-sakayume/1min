import ko from '../../content/copy/ko.json';
import { COPY_REF_PREFIX, copySchema } from '../../content/schema/copy';

const table = copySchema.parse(ko);

/** 문구 키 또는 `copy:` 참조를 한국어로. 없는 키는 키 자체를 보여 준다(콘텐츠 검사에서 잡힘). */
export function copy(keyOrRef: string, vars?: Record<string, string | number>): string {
  const key = keyOrRef.startsWith(COPY_REF_PREFIX)
    ? keyOrRef.slice(COPY_REF_PREFIX.length)
    : keyOrRef;
  const text = table[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}
