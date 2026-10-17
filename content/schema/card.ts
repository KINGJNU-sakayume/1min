import { z } from 'zod';
import {
  evidenceSchema,
  failEffectSchema,
  copyRefSchema,
  msSchema,
  partSchema,
  posTicksSchema,
  slugSchema,
  stepTargetSchema,
} from './common';

/** 카드 데이터 형식 — 정본: docs/design/hazard-system.md §3 (결정 0003로 보강) */
export const surfaceSchema = z.enum([
  'overlay',
  'input',
  'layout',
  'time',
  'info',
  'ambient',
  'reset',
]);
export const counterSchema = z.enum(['tap', 'hold', 'type', 'swipe', 'wait', 'choose', 'ignore']);

/** 카드가 활성일 때 엔진이 하는 일 (선언형 원시 효과의 조합) */
export const effectSchema = z.object({
  /** UI 표현 방식. 엔진 동작에는 영향 없음 */
  overlay: z.enum(['none', 'banner', 'modal', 'sheet', 'spinner', 'keyboard']).default('none'),
  /** 활성 동안 단계 입력을 막는다 */
  blocksStep: z.boolean().default(false),
  /** 활성 동안 대상 입력을 너무 빨리 반복하면 카드 실패 */
  rateLimit: z
    .object({
      target: stepTargetSchema,
      maxTaps: z.number().int().positive(),
      windowTicks: posTicksSchema,
    })
    .optional(),
  /** 활성 순간 현재 단계 제한 시간을 줄인다 */
  squeezeTimerTicks: posTicksSchema.optional(),
  /** 활성 순간 현재 단계에 보내는 신호 (`seatMap.release` 등). 단계 종류가 다르면 무시 */
  hook: z
    .string()
    .regex(/^[a-zA-Z]+\.[a-zA-Z]+$/)
    .optional(),
  /** type 카드의 입력 코드 생성 규칙 (layout 스트림) */
  code: z
    .object({ length: z.number().int().min(3).max(8), alphabet: z.string().min(2) })
    .optional(),
});

export const resolveSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tap'), target: partSchema }),
  z.object({ kind: z.literal('type') }),
  z.object({ kind: z.literal('hold'), target: partSchema, ticks: posTicksSchema }),
  z.object({
    kind: z.literal('choose'),
    options: z
      .array(z.object({ id: partSchema, label: copyRefSchema, correct: z.boolean() }))
      .min(2)
      .refine((o) => o.filter((x) => x.correct).length === 1, '정답은 정확히 1개'),
  }),
  /** 건드리면 실패. `step...`은 단계 대상, 그 외는 카드 자신의 부분 */
  z.object({ kind: z.literal('avoid'), target: z.union([stepTargetSchema, partSchema]) }),
  /** 무시가 정답. 건드리면 실패 효과(보통 시간 손실) */
  z.object({ kind: z.literal('ignore'), target: partSchema }),
  z.object({ kind: z.literal('none') }),
]);

export const cardSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*\.[a-z0-9-]+$/, '{스테이지|common}.{이름}'),
    version: z.number().int().positive(),
    surface: surfaceSchema,
    counter: counterSchema,
    tags: z.array(slugSchema),
    cost: z.number().int().min(1).max(5),
    weight: z.number().positive(),
    minDifficulty: z.number().int().min(1).max(5),
    stages: z.union([z.literal('*'), z.array(slugSchema).min(1)]),
    telegraphMs: msSchema,
    activeMs: msSchema.positive().nullable(),
    cooldownMs: msSchema.optional(),
    /** 만료 시 결과. 생략하면 wait/ignore는 resolve, 그 외는 fail (결정 0003 #5) */
    expire: z.enum(['resolve', 'fail']).optional(),
    window: z
      .object({
        steps: z.array(slugSchema).min(1).optional(),
        stepKinds: z.array(z.string()).min(1).optional(),
      })
      .optional(),
    effect: effectSchema,
    resolve: resolveSchema,
    failEffect: failEffectSchema,
    exclusiveWith: z.array(z.string()).optional(),
    synergyWith: z
      .array(z.object({ tag: slugSchema, bonusCost: z.number().int().min(0), name: copyRefSchema }))
      .optional(),
    /** 문구 키 접두. `{copyKey}.title`, `.body` 등을 copy/ko.json에서 찾는다 */
    copyKey: z.string().regex(/^haz\.[a-zA-Z0-9.-]+$/),
    evidence: evidenceSchema,
    touchRisk: z
      .enum(['keyboard', 'smallTarget', 'scrollTrap', 'pullToRefresh', 'multiTouch'])
      .optional(),
  })
  .superRefine((c, ctx) => {
    const allowed: Record<z.infer<typeof counterSchema>, string[]> = {
      tap: ['tap'],
      hold: ['hold'],
      type: ['type'],
      swipe: ['tap'],
      choose: ['choose'],
      wait: ['avoid', 'none'],
      ignore: ['ignore', 'none'],
    };
    if (!allowed[c.counter].includes(c.resolve.kind)) {
      ctx.addIssue({
        code: 'custom',
        message: `counter ${c.counter}에 resolve ${c.resolve.kind} 불가`,
      });
    }
    if (c.resolve.kind === 'type' && !c.effect.code) {
      ctx.addIssue({ code: 'custom', message: 'type 카드는 effect.code가 필요' });
    }
    if (c.activeMs === null && ['avoid', 'ignore', 'none'].includes(c.resolve.kind)) {
      ctx.addIssue({
        code: 'custom',
        message: 'activeMs가 null이면 플레이어가 해결할 수 있어야 한다',
      });
    }
  });

export const cardFileSchema = z.object({ cards: z.array(cardSchema).min(1) });

export type CardJson = z.infer<typeof cardSchema>;
export type Surface = z.infer<typeof surfaceSchema>;
export type Counter = z.infer<typeof counterSchema>;
export type ResolveSpec = z.infer<typeof resolveSchema>;
export type EffectSpec = z.infer<typeof effectSchema>;
