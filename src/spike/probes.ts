/**
 * 모바일 스파이크 프로브 (docs/design/difficulty-results-touch.md §4.3).
 * 각 항목의 "브라우저가 지원한다고 말하는가"만 판정한다. 실제 체감 동작은 실기기 확인 필요.
 */
export interface ProbeResult {
  id: string;
  label: string;
  value: string;
  ok: boolean | null; // null = 사용자 조작이 필요해 아직 모름
}

const supports = (prop: string, value: string): boolean =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports(prop, value);

export function staticProbes(): ProbeResult[] {
  const vv = window.visualViewport;
  const nav = navigator as Navigator & { standalone?: boolean };
  return [
    {
      id: 'visualViewport',
      label: '① visualViewport API',
      value: vv ? `height=${Math.round(vv.height)} inner=${window.innerHeight}` : '없음',
      ok: Boolean(vv),
    },
    {
      id: 'overscroll',
      label: '② overscroll-behavior: none',
      value: String(supports('overscroll-behavior', 'none')),
      ok: supports('overscroll-behavior', 'none'),
    },
    {
      id: 'touchAction',
      label: '③ touch-action: manipulation (더블탭 줌 억제)',
      value: String(supports('touch-action', 'manipulation')),
      ok: supports('touch-action', 'manipulation'),
    },
    {
      id: 'audioContext',
      label: '④ AudioContext 존재',
      value: String('AudioContext' in window || 'webkitAudioContext' in window),
      ok: 'AudioContext' in window || 'webkitAudioContext' in window,
    },
    {
      id: 'webShare',
      label: '⑤ navigator.share',
      value: String(typeof navigator.share === 'function'),
      ok: typeof navigator.share === 'function',
    },
    {
      id: 'clipboard',
      label: '⑤ navigator.clipboard.writeText',
      value: String(Boolean(navigator.clipboard?.writeText)),
      ok: Boolean(navigator.clipboard?.writeText),
    },
    {
      id: 'standalone',
      label: '⑥ 홈 화면(standalone) 실행 중',
      value: String(matchMedia('(display-mode: standalone)').matches || nav.standalone === true),
      ok: null,
    },
    {
      id: 'vibrate',
      label: '(참고) navigator.vibrate',
      value: String(typeof navigator.vibrate === 'function'),
      ok: typeof navigator.vibrate === 'function',
    },
    { id: 'localStorage', label: '⑦ localStorage 쓰기', ...probeLocalStorage() },
  ];
}

function probeLocalStorage(): { value: string; ok: boolean } {
  const key = 'ibunjeon:spike';
  try {
    // 약 512KB를 써 보고 지운다
    localStorage.setItem(key, 'x'.repeat(512 * 1024));
    localStorage.removeItem(key);
    return { value: '512KB 쓰기 성공', ok: true };
  } catch (e) {
    return { value: `실패: ${e instanceof Error ? e.name : String(e)}`, ok: false };
  }
}

/** 사용자 탭 뒤 오디오 잠금 해제 시도. */
export async function unlockAudio(): Promise<ProbeResult> {
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return { id: 'audioUnlock', label: '④ 오디오 잠금 해제', value: '미지원', ok: false };
  const ctx = new Ctor();
  const before = ctx.state;
  await ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
  return {
    id: 'audioUnlock',
    label: '④ 오디오 잠금 해제',
    value: `${before} → ${ctx.state}`,
    ok: ctx.state === 'running',
  };
}

export { shareOrCopy as shareWithFallback } from '../ui/share';
