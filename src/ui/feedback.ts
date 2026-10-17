import type { EngineEvent } from '../engine/types';

/**
 * 소리·진동 (부작용은 엔진 이벤트를 받아 UI에서만). 오디오는 첫 사용자 탭 뒤에만 켜진다.
 * iOS 사파리는 진동을 지원하지 않을 가능성이 높다 [기억] → 시각 연출이 기본.
 */
let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch (e) {
    console.info('오디오 사용 불가', e);
    ctx = null;
  }
}

function beep(freq: number, ms: number, gain = 0.04): void {
  if (!ctx || ctx.state !== 'running') return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + ms / 1000);
}

function buzz(ms: number): void {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

export function playFeedback(events: readonly EngineEvent[], muted: boolean): void {
  if (muted) return;
  for (const e of events) {
    if (e.type === 'card' && e.status === 'telegraph') beep(880, 60);
    else if (e.type === 'card' && e.status === 'failed') {
      beep(180, 160);
      buzz(80);
    } else if (e.type === 'card' && e.status === 'resolved') beep(1320, 40, 0.025);
    else if (
      e.type === 'wrong' ||
      e.type === 'blocked' ||
      e.type === 'locked' ||
      e.type === 'early'
    ) {
      beep(220, 80);
      buzz(30);
    } else if (e.type === 'judgment') beep(e.judgment === 'PERFECT' ? 1568 : 990, 90);
    else if (e.type === 'finish') beep(e.outcome === 'success' ? 1046 : 130, 300, 0.05);
  }
}
