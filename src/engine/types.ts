import type { CardJson } from '../../content/schema/card';
import type { DirectorJson } from '../../content/schema/director';
import type { FixedScheduleJson, Judgment, StageJson, StepJson } from '../../content/schema/stage';

export type { Judgment, StageJson, StepJson, CardJson, DirectorJson, FixedScheduleJson };

/** 엔진이 쓰는 카드 정의 (밀리초 → 틱 변환, 기본값 채움) */
export interface CardDef extends Omit<
  CardJson,
  'telegraphMs' | 'activeMs' | 'cooldownMs' | 'expire'
> {
  telegraphTicks: number;
  activeTicks: number | null;
  cooldownTicks: number;
  expire: 'resolve' | 'fail';
}

export interface EngineContent {
  director: DirectorJson;
  cards: ReadonlyMap<string, CardDef>;
  stages: ReadonlyMap<string, StageJson>;
  fixed: ReadonlyMap<string, FixedScheduleJson>;
  /** 카드·스테이지·디렉터 데이터 해시. 공유 코드 호환 판단 */
  contentVersion: string;
}

/** 카드가 언제 뜨는가: 판 시작 기준 틱, 또는 특정 단계 진입 후 틱 */
export type Anchor =
  { kind: 'run'; tick: number } | { kind: 'step'; stepId: string; offset: number };

export interface ScheduleEntry {
  idx: number;
  cardId: string;
  anchor: Anchor;
  /** type 카드의 정답 코드 (layout 스트림) */
  code?: string;
  /** choose 카드 선택지 표시 순서 (layout 스트림) */
  optionOrder?: string[];
}

export interface Schedule {
  stageId: string;
  level: number;
  seedString: string;
  contentVersion: string;
  /** 디렉터가 배치에 쓴 예산 (시너지 보너스 포함) */
  spent: number;
  entries: readonly ScheduleEntry[];
}

export type Action = 'start' | 'open' | 'tap' | 'hold' | 'type' | 'swipe';

/** 논리 행동 (game-rules §7). 좌표·터치 이벤트는 UI가 대상 ID로 바꿔서 보낸다. */
export interface Input {
  tick: number;
  action: Action;
  /** `step:...` 또는 `card:{idx}:{part}` */
  target: string;
  value?: string;
}

export type Phase = 'READY' | 'PREROLL' | 'RUNNING' | 'RESULT';

export type CardStatus =
  'scheduled' | 'pending' | 'telegraph' | 'active' | 'resolved' | 'failed' | 'skipped';

export interface CardRuntime {
  idx: number;
  status: CardStatus;
  pendingSince: number | null;
  telegraphAt: number | null;
  activeAt: number | null;
  /** 활성 종료 예정 틱 (activeMs가 null이면 null) */
  endAt: number | null;
  finishedAt: number | null;
  late: boolean;
  /** rateLimit 판정용 최근 탭 틱 */
  taps: readonly number[];
}

export interface QueueLocal {
  kind: 'queue';
  count: number;
  /** 현재 기준 속도 (인원/틱) */
  baseRate: number;
  rate: number;
  segmentLeft: number;
  initial: number;
}
export interface TextInputLocal {
  kind: 'textInput';
  code: string;
  wrong: number;
  clearSeq: number;
}
export interface SeatLocal {
  kind: 'seatMap';
  zone: string;
  selected: string | null;
  selectedAt: number;
  /** 좌석 → 다른 사람이 가져간 틱 (-1 = 처음부터 매진). 없으면 끝까지 빈자리 */
  takenAt: Readonly<Record<string, number>>;
  popup: 'conflict' | null;
}
export interface QuantityLocal {
  kind: 'quantity';
  qty: number;
  popup: 'zero' | null;
}
export interface PaymentLocal {
  kind: 'payment';
  method: string | null;
  agreed: boolean;
}
export interface ChooseLocal {
  kind: 'choose';
  order: readonly string[];
}
export interface SimpleLocal {
  kind: 'openButton' | 'hold' | 'confirm';
}
export type StepLocal =
  | QueueLocal
  | TextInputLocal
  | SeatLocal
  | QuantityLocal
  | PaymentLocal
  | ChooseLocal
  | SimpleLocal;

export interface RunState {
  phase: Phase;
  tick: number;
  /** 정각(T0). open 모드는 프리롤 뒤, deadline 모드는 0 */
  runStartTick: number;
  penaltyTicks: number;
  lockUntil: number;
  early: boolean;
  judgment: Judgment | null;
  openTick: number | null;
  stepIndex: number;
  stepEnteredAt: number;
  stepDeadline: number | null;
  step: StepLocal;
  cards: readonly CardRuntime[];
  rng: { layout: number; queue: number; cosmetic: number };
  combo: number;
  /** 결과 칭호 조건에 쓰는 카운터. 이름은 STAT_NAMES */
  stats: Readonly<Record<string, number>>;
  synergies: readonly string[];
  finishedAt: number | null;
  outcome: 'success' | 'fail' | null;
  reason: string | null;
}

export type EngineEvent =
  | { type: 'phase'; phase: Phase }
  | { type: 'judgment'; judgment: Judgment; delta: number }
  | { type: 'early' }
  | { type: 'locked' }
  | { type: 'blocked'; by: number }
  | { type: 'stepEnter'; stepId: string }
  | { type: 'stepComplete'; stepId: string }
  | { type: 'stepSkipped'; stepId: string }
  | { type: 'stepTimeout'; stepId: string }
  | { type: 'stepReset'; to: string }
  | { type: 'card'; idx: number; status: CardStatus }
  | { type: 'synergy'; name: string }
  | { type: 'wrong'; target: string }
  | { type: 'notice'; key: string }
  | { type: 'finish'; outcome: 'success' | 'fail'; reason: string };

export interface RunOptions {
  /** 접근성 시간 연장 (결과는 로컬 assist 플래그로만 구분) */
  assist: boolean;
}

/** 판 하나를 돌리는 데 필요한 불변 데이터 */
export interface RunContext {
  content: EngineContent;
  stage: StageJson;
  level: number;
  maxSlots: number;
  schedule: Schedule;
  /** schedule.entries[i]의 카드 정의 */
  defs: readonly CardDef[];
  t0: number;
  durationTicks: number;
  options: RunOptions;
}
