import { z } from 'zod';
import { copyRefSchema } from './copy';

/** 근거 라벨: [확인] [2차] [기억] [추측] [미확인] (결정 0002 #3) */
export const evidenceLevelSchema = z.enum([
  'confirmed',
  'secondary',
  'memory',
  'guess',
  'unverified',
]);

export const evidenceSchema = z.object({
  level: evidenceLevelSchema,
  sources: z.array(z.string().regex(/^S\d+$/)).optional(),
  note: z.string().optional(),
});

export const claimEvidenceSchema = evidenceSchema.extend({ claim: z.string().min(1) });

/** 50ms 틱의 배수인 밀리초 값 */
export const msSchema = z.number().int().nonnegative().multipleOf(50);
export const ticksSchema = z.number().int().nonnegative();
export const posTicksSchema = z.number().int().positive();

export const slugSchema = z.string().regex(/^[a-z][a-z0-9-]*$/, '소문자·숫자·하이픈');
/** 화면 대상 이름 조각 (`refresh`, `ok`, `opt-a`) */
export const partSchema = z.string().regex(/^[a-z][a-zA-Z0-9-]*$/);
/** 단계 입력 대상 패턴: `step` 또는 `step:refresh`, `step:zone` 등 (접두 일치) */
export const stepTargetSchema = z.string().regex(/^step(:[a-zA-Z0-9-]+)*$/);

export const rangeSchema = z
  .object({ min: z.number(), max: z.number() })
  .refine((r) => r.min <= r.max, 'min ≤ max');
export const intRangeSchema = z
  .object({ min: z.number().int(), max: z.number().int() })
  .refine((r) => r.min <= r.max, 'min ≤ max');

/** 실패 효과 (hazard-system §2). 카드와 단계 시간 초과가 공유한다. */
export const failEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('lock'), ticks: posTicksSchema }),
  z.object({ kind: z.literal('penalty'), ticks: posTicksSchema }),
  z.object({ kind: z.literal('resetStep'), to: slugSchema.optional() }),
  z.object({ kind: z.literal('queueBack'), amount: z.number().int().positive() }),
  z.object({ kind: z.literal('fatal'), reason: z.string().optional() }),
]);

export { copyRefSchema };
export type FailEffect = z.infer<typeof failEffectSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
