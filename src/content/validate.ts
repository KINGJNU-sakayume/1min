import ko from '../../content/copy/ko.json';
import { copySchema } from '../../content/schema/copy';

/** 모든 콘텐츠 JSON을 검증하고 사람이 읽을 오류 목록을 돌려준다. 빈 배열이면 통과. */
export function validateAllContent(): string[] {
  const errors: string[] = [];
  const copyResult = copySchema.safeParse(ko);
  if (!copyResult.success) {
    for (const issue of copyResult.error.issues) {
      errors.push(`copy/ko.json ${issue.path.join('.')}: ${issue.message}`);
    }
  }
  return errors;
}
