import { z } from 'zod';

/** 문구 키 → 한국어. 키는 점으로 구분한 소문자·카멜 경로. */
export const copySchema = z.record(
  z.string().regex(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9-]+)+$/, '문구 키 형식'),
  z.string().min(1),
);

export type Copy = z.infer<typeof copySchema>;

/** 스테이지·카드 JSON에서 문구를 참조할 때 쓰는 접두 (`copy:stage.ticketing.title`). */
export const COPY_REF_PREFIX = 'copy:';
export const copyRefSchema = z.string().startsWith(COPY_REF_PREFIX);
