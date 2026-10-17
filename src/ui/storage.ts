import { z } from 'zod';

/**
 * 로컬 저장 (game-rules §12). 키 접두 `ibunjeon:v1:` [이름 임시].
 * 모든 접근은 try/catch: 프라이빗 모드·용량 초과·차단이어도 앱은 메모리 값으로 계속 동작한다.
 */
const PREFIX = 'ibunjeon:v1:';
export const HISTORY_MAX = 100;

export const settingsSchema = z.object({
  /** 시간 연장 (60초 → 90초). 공유 카드에는 표시하지 않는다 (difficulty §4.2) */
  assist: z.boolean(),
  reducedMotion: z.boolean(),
  muted: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;

const profileSchema = z.object({
  schema: z.literal(1),
  settings: settingsSchema,
  tutorialDone: z.boolean(),
});
export type Profile = z.infer<typeof profileSchema>;

const stageProgressSchema = z.object({
  attempts: z.number().int().min(0),
  wins: z.number().int().min(0),
  bestStars: z.number().int().min(0).max(3),
  bestRemaining: z.number().int().min(0),
  bestTitleId: z.string().nullable(),
});
const progressSchema = z.object({
  schema: z.literal(1),
  stages: z.record(z.string(), stageProgressSchema),
});
export type Progress = z.infer<typeof progressSchema>;
export type StageProgress = z.infer<typeof stageProgressSchema>;

const historyEntrySchema = z.object({
  at: z.string(),
  seed: z.string(),
  stageId: z.string(),
  level: z.number().int(),
  titleId: z.string(),
  outcome: z.enum(['success', 'fail']),
  remaining: z.number().int(),
  stars: z.number().int(),
  assist: z.boolean(),
  contentVersion: z.string(),
});
const historySchema = z.object({ schema: z.literal(1), entries: z.array(historyEntrySchema) });
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const DEFAULT_PROFILE: Profile = {
  schema: 1,
  settings: { assist: false, reducedMotion: false, muted: false },
  tutorialDone: false,
};
const EMPTY_PROGRESS: Progress = { schema: 1, stages: {} };
const EMPTY_STAGE: StageProgress = {
  attempts: 0,
  wins: 0,
  bestStars: 0,
  bestRemaining: 0,
  bestTitleId: null,
};

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createStore(kv: KeyValue | null) {
  const memory = new Map<string, string>();

  const read = <T>(key: string, schema: z.ZodType<T>, defaults: T): T => {
    // 기본값 객체를 고쳐 쓰지 않도록 매번 복사
    const fallback = structuredClone(defaults);
    let raw = memory.get(key) ?? null;
    try {
      raw = kv?.getItem(PREFIX + key) ?? raw;
    } catch (e) {
      console.info('저장소 읽기 실패, 메모리 값 사용', e);
    }
    if (raw === null) return fallback;
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : fallback;
    } catch (e) {
      console.info('저장 데이터가 깨져 기본값 사용', e);
      return fallback;
    }
  };

  const write = (key: string, value: unknown) => {
    const raw = JSON.stringify(value);
    memory.set(key, raw);
    try {
      kv?.setItem(PREFIX + key, raw);
    } catch (e) {
      console.info('저장소 쓰기 실패(용량·프라이빗 모드), 이번 세션에만 유지', e);
    }
  };

  return {
    profile: (): Profile => read('profile', profileSchema, DEFAULT_PROFILE),
    saveSettings(settings: Settings) {
      write('profile', { ...this.profile(), settings });
    },
    progress: (): Progress => read('progress', progressSchema, EMPTY_PROGRESS),
    stage(stageId: string): StageProgress {
      return this.progress().stages[stageId] ?? EMPTY_STAGE;
    },
    history: (): HistoryEntry[] =>
      read('history', historySchema, { schema: 1, entries: [] }).entries,

    /** 한 판 기록: 진행·최근 기록·튜토리얼 완료 */
    recordRun(entry: HistoryEntry, tutorial: boolean) {
      const progress = this.progress();
      const prev = progress.stages[entry.stageId] ?? EMPTY_STAGE;
      const win = entry.outcome === 'success';
      const better =
        win &&
        (entry.stars > prev.bestStars ||
          (entry.stars === prev.bestStars && entry.remaining > prev.bestRemaining));
      progress.stages[entry.stageId] = {
        attempts: prev.attempts + 1,
        wins: prev.wins + (win ? 1 : 0),
        bestStars: better ? entry.stars : prev.bestStars,
        bestRemaining: better ? entry.remaining : prev.bestRemaining,
        bestTitleId: better ? entry.titleId : (prev.bestTitleId ?? entry.titleId),
      };
      write('progress', progress);
      write('history', { schema: 1, entries: [entry, ...this.history()].slice(0, HISTORY_MAX) });
      if (tutorial && win) write('profile', { ...this.profile(), tutorialDone: true });
    },
  };
}

export type Store = ReturnType<typeof createStore>;

function browserStorage(): KeyValue | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch (e) {
    console.info('localStorage 접근 불가', e);
    return null;
  }
}

export const store = createStore(browserStorage());
