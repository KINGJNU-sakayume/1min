import { describe, expect, it } from 'vitest';
import {
  createStore,
  DEFAULT_PROFILE,
  HISTORY_MAX,
  type HistoryEntry,
  type KeyValue,
} from './storage';

const memoryKV = (): KeyValue & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  at: '2026-10-17T00:00:00.000Z',
  seed: 'ticketing|1|K7M2Q',
  stageId: 'ticketing',
  level: 1,
  titleId: 'success-default',
  outcome: 'success',
  remaining: 300,
  stars: 2,
  assist: false,
  contentVersion: 'abc123',
  ...over,
});

describe('저장소', () => {
  it('비어 있으면 기본값', () => {
    const s = createStore(memoryKV());
    expect(s.profile()).toEqual(DEFAULT_PROFILE);
    expect(s.history()).toEqual([]);
  });

  it('진행·최근 기록·튜토리얼 완료를 남긴다', () => {
    const s = createStore(memoryKV());
    s.recordRun(entry({ stageId: 'tutorial', titleId: 'success' }), true);
    s.recordRun(entry(), false);
    s.recordRun(entry({ outcome: 'fail', titleId: 'fail-default', stars: 0 }), false);
    expect(s.profile().tutorialDone).toBe(true);
    expect(s.stage('ticketing')).toMatchObject({
      attempts: 2,
      wins: 1,
      bestStars: 2,
      bestTitleId: 'success-default',
    });
    expect(s.history()).toHaveLength(3);
  });

  it(`최근 기록은 ${HISTORY_MAX}개까지`, () => {
    const s = createStore(memoryKV());
    for (let i = 0; i < HISTORY_MAX + 20; i++) s.recordRun(entry({ remaining: i }), false);
    expect(s.history()).toHaveLength(HISTORY_MAX);
    expect(s.history()[0]?.remaining).toBe(HISTORY_MAX + 19);
  });

  it('깨진 JSON·다른 스키마면 기본값', () => {
    const kv = memoryKV();
    kv.data.set('ibunjeon:v1:profile', '{not json');
    kv.data.set('ibunjeon:v1:progress', JSON.stringify({ schema: 99 }));
    const s = createStore(kv);
    expect(s.profile()).toEqual(DEFAULT_PROFILE);
    expect(s.progress().stages).toEqual({});
  });

  it('쓰기·읽기가 던져도(프라이빗 모드·용량 초과) 메모리로 동작한다', () => {
    const broken: KeyValue = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const s = createStore(broken);
    s.saveSettings({ assist: true, reducedMotion: true, muted: false });
    expect(s.profile().settings.assist).toBe(true);
    s.recordRun(entry(), false);
    expect(s.history()).toHaveLength(1);
  });

  it('localStorage가 아예 없어도 동작', () => {
    const s = createStore(null);
    s.recordRun(entry(), false);
    expect(s.stage('ticketing').attempts).toBe(1);
  });
});
