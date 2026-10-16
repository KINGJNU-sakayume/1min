import { z } from 'zod';
import {
  claimEvidenceSchema,
  copyRefSchema,
  failEffectSchema,
  intRangeSchema,
  partSchema,
  posTicksSchema,
  slugSchema,
} from './common';

/** 스테이지 데이터 형식 — 정본: docs/spec/stage-format.md */

const judgmentFactorsSchema = z.object({
  PERFECT: z.number().positive(),
  GOOD: z.number().positive(),
  LATE: z.number().positive(),
  SLOW: z.number().positive(),
  EARLY: z.number().positive(),
});

const stepCommon = {
  id: slugSchema,
  title: copyRefSchema,
  /** 단계 진입 후 제한 시간 (결제 타이머 등) */
  timeLimitTicks: posTicksSchema.optional(),
  /** 제한 시간이 끝났을 때. 기본은 판 실패 */
  onTimeout: failEffectSchema.optional(),
  /** 이 난이도 이하에서는 자동 통과 (realism-spec §1.1 시간 압축) */
  skippableAtLevel: z.number().int().min(0).max(5).optional(),
};

const optionSchema = z.object({ id: partSchema, label: copyRefSchema, correct: z.boolean() });

export const stepSchema = z.discriminatedUnion('kind', [
  z.object({
    ...stepCommon,
    kind: z.literal('openButton'),
    completesWhen: z.object({ type: z.literal('openJudged') }),
  }),
  z.object({
    ...stepCommon,
    kind: z.literal('queue'),
    completesWhen: z.object({ type: z.literal('queueZero') }),
    queue: z.object({
      /** 판정별 계수를 곱하기 전 기준 인원 ("내 앞에 N명") */
      base: z.number().int().positive(),
      factors: judgmentFactorsSchema,
      /** 판정별 평균 대기 틱. 줄어드는 속도 = 시작 인원 / 대기 틱 */
      waitTicks: judgmentFactorsSchema,
      /** 시작 인원 ± 비율 흔들림 (queue 스트림) */
      jitter: z.number().min(0).max(1),
      /** 속도를 다시 뽑는 구간 길이 (queue 스트림) */
      segmentTicks: posTicksSchema,
      /** 구간이 멈출 확률 ("빨라졌다 멈춘다", realism §1.2) */
      pauseChance: z.number().min(0).max(1),
      /** 구간 속도 배율 범위 */
      rateJitter: z
        .object({ min: z.number().min(0), max: z.number().positive() })
        .refine((r) => r.min <= r.max, 'min ≤ max'),
      /** 새로고침 등으로 맨 뒤로 갈 때의 인원과 대기 틱 */
      resetTo: z.number().int().positive(),
      resetWaitTicks: posTicksSchema,
    }),
  }),
  z.object({
    ...stepCommon,
    kind: z.literal('textInput'),
    completesWhen: z.object({ type: z.literal('inputMatches') }),
    input: z.object({
      length: intRangeSchema,
      alphabet: z.string().min(2),
      /** 화면 안내 문구 */
      prompt: copyRefSchema,
      /** 오입력 시 코드를 새로 만든다 (보안문자) */
      regenerateOnWrong: z.boolean(),
    }),
  }),
  z.object({
    ...stepCommon,
    kind: z.literal('seatMap'),
    completesWhen: z.object({ type: z.literal('seatHeld') }),
    seatMap: z.object({
      zones: z
        .array(
          z.object({
            id: partSchema,
            label: copyRefSchema,
            floor: z.number().int().positive(),
            rows: z.number().int().min(1).max(26),
            cols: z.number().int().min(1).max(40),
            initialTakenRatio: z.number().min(0).max(0.98),
          }),
        )
        .min(1),
      /** 경쟁자가 좌석을 가져가는 간격과 수 (layout 스트림) */
      competitor: z.object({ waveTicks: intRangeSchema, perWave: intRangeSchema }),
      /** 가져간 좌석이 화면에 회색으로 보이기까지의 지연 → "이미 선택된 좌석입니다" */
      revealLagTicks: z.number().int().min(0),
    }),
  }),
  z.object({
    ...stepCommon,
    kind: z.literal('quantity'),
    completesWhen: z.object({ type: z.literal('qtyAtLeast'), min: z.number().int().positive() }),
    quantity: z.object({ initial: z.number().int().min(0), max: z.number().int().positive() }),
  }),
  z.object({
    ...stepCommon,
    kind: z.literal('payment'),
    completesWhen: z.object({ type: z.literal('paid') }),
    payment: z.object({
      methods: z.array(z.object({ id: partSchema, label: copyRefSchema })).min(1),
      requireAgree: z.boolean(),
      /** 화면 표시용 가상 시간 배율 (20초를 "05:00"처럼 보이게) */
      displayScale: z.number().positive(),
    }),
  }),
  z.object({
    ...stepCommon,
    kind: z.literal('choose'),
    completesWhen: z.object({ type: z.literal('pick') }),
    choose: z.object({
      options: z
        .array(optionSchema)
        .min(2)
        .refine((o) => o.some((x) => x.correct), '정답 ≥ 1'),
      /** 틀리면 잠금 틱 */
      wrongLockTicks: z.number().int().min(0),
    }),
  }),
  z.object({
    ...stepCommon,
    kind: z.literal('hold'),
    completesWhen: z.object({ type: z.literal('held') }),
    hold: z.object({ ticks: posTicksSchema }),
  }),
  z.object({
    ...stepCommon,
    kind: z.literal('confirm'),
    completesWhen: z.object({ type: z.literal('confirmed') }),
  }),
]);

export const difficultySchema = z.object({
  level: z.number().int().min(0).max(5),
  budget: z.number().int().min(0),
  maxSlots: z.number().int().min(1).max(3),
  fixedSchedule: slugSchema.optional(),
});

export const resultRuleSchema = z.object({
  id: slugSchema,
  when: z.object({
    outcome: z.enum(['success', 'fail']),
    reason: z.string().optional(),
    remainingTicksLte: z.number().int().optional(),
    remainingTicksGte: z.number().int().optional(),
    failedCardIncludes: z.string().optional(),
    minCount: z.number().int().positive().optional(),
    stat: z.object({ name: z.string(), gte: z.number() }).optional(),
    judgment: z.enum(['PERFECT', 'GOOD', 'LATE', 'SLOW', 'EARLY']).optional(),
  }),
  title: copyRefSchema,
  line: copyRefSchema.optional(),
});

export const stageSchema = z.object({
  id: slugSchema,
  version: z.number().int().positive(),
  mode: z.enum(['open', 'deadline']),
  tutorial: z.boolean().optional(),
  title: copyRefSchema,
  brand: z.object({
    name: copyRefSchema,
    fictional: z.literal(true),
    disclaimer: copyRefSchema,
    forbidden: z.array(z.string()),
  }),
  durationTicks: posTicksSchema,
  steps: z.array(stepSchema).min(1).max(8),
  deck: z.object({
    common: z.array(z.string()),
    specific: z.array(z.string()),
    mustInclude: z.object({ specificMin: z.number().int().min(0) }),
    weightOverrides: z.record(z.string(), z.number().positive()).optional(),
  }),
  difficulty: z.array(difficultySchema).min(1).max(6),
  results: z.array(resultRuleSchema).min(2),
  theme: z.object({
    tokens: slugSchema,
    seatShape: z.string().optional(),
    font: copyRefSchema.optional(),
  }),
  evidence: z.array(claimEvidenceSchema).min(1),
  legal: z.object({
    noRealBrands: z.literal(true),
    noRealPeople: z.literal(true),
    noRealInputRequested: z.literal(true),
    disclaimerShown: z.literal(true),
    assetLicenses: z.string(),
    reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});

/** 고정 스케줄 (튜토리얼 등) — content/stages/fixed/{name}.json */
export const fixedScheduleSchema = z.object({
  name: slugSchema,
  entries: z
    .array(
      z.object({
        card: z.string(),
        startTick: z.number().int().min(0),
        code: z.string().optional(),
      }),
    )
    .min(0),
});

export type StageJson = z.infer<typeof stageSchema>;
export type StepJson = z.infer<typeof stepSchema>;
export type StepKind = StepJson['kind'];
export type ResultRule = z.infer<typeof resultRuleSchema>;
export type FixedScheduleJson = z.infer<typeof fixedScheduleSchema>;
export type Judgment = keyof z.infer<typeof judgmentFactorsSchema>;
