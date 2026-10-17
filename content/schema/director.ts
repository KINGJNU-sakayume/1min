import { z } from 'zod';
import { msSchema, posTicksSchema } from './common';

const botSchema = z.object({
  reactionTicks: z.number().int().min(0),
  actionGapTicks: z.number().int().min(1),
  typeTicksPerChar: z.number().int().min(0),
  openDelayTicks: z.number().int().min(0),
  stepReadTicks: z.number().int().min(0),
});

/** 전역 엔진·디렉터 파라미터 (현실성·밸런스 수치를 코드 밖에 둔다 — CLAUDE.md 규칙 4) */
export const directorSchema = z.object({
  tickMs: z.literal(50),
  /** open 모드 정각 전 카운트다운 (game-rules §3, ≤5초) */
  prerollTicks: z.number().int().min(20).max(100),
  judgment: z.object({
    perfectTicks: posTicksSchema,
    goodTicks: posTicksSchema,
    lateTicks: posTicksSchema,
    earlyLockTicks: posTicksSchema,
  }),
  cooldownMsDefault: msSchema,
  /** activeMs가 null인 카드의 배치 계산용 추정 지속 */
  nominalActiveMs: msSchema,
  /** 만료 시 잠금·되돌림이 발동하는 카드의 최소 텔레그래프 (hazard-system §5.5) */
  telegraphMinMsForPunishing: msSchema,
  /** 같은 surface 연속 허용 개수 (§5.4: 3회 연속 금지 → 2) */
  maxSameSurfaceRun: z.number().int().min(1),
  /** 판 길이 비율 구간별 예산 가중치 (difficulty §1.3) */
  ramp: z
    .array(z.object({ untilPct: z.number().positive().max(100), weight: z.number().min(0) }))
    .min(1),
  /** 카드 배치가 끝나야 하는 판 길이 비율 (마지막 결제 압박 구간 확보) */
  lastStartPct: z.number().positive().max(100),
  placementAttempts: z.number().int().positive(),
  /** 단계 고정 카드(window 있음)가 단계 진입 후 뜨기까지의 지연 범위 (결정 0002 #18) */
  stepAnchorOffsetTicks: z
    .object({ min: z.number().int().min(0), max: z.number().int().min(0) })
    .refine((r) => r.min <= r.max, 'min ≤ max'),
  /** 슬롯·상호배제 때문에 대기 중인 카드가 이 이상 밀리면 건너뛴다 */
  pendingMaxTicks: posTicksSchema,
  /** timer-squeeze가 남겨 두는 최소 제한 시간 */
  squeezeMinRemainTicks: posTicksSchema,
  maxSeedRetries: z.number().int().min(0),
  /** 활성 구간의 이 비율 이후 해결하면 "늦게 해결" 🟨 */
  lateResolveFraction: z.number().min(0).max(1),
  stars: z.object({ twoStarRemainingTicks: z.number().int().min(0) }),
  assistDurationFactor: z.number().min(1),
  /** 솔버 봇: 빠른 사람 수준 (공정성 검증 기준) */
  solver: botSchema,
  /** 튜토리얼 "안내대로만" 봇: 느긋한 사람 */
  guided: botSchema,
  /** 밸런스 리포트용 "보통 사람" 봇 */
  humanish: botSchema,
});

export type DirectorJson = z.infer<typeof directorSchema>;
