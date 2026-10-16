import '../index.css';
import { shareWithFallback, staticProbes, unlockAudio, type ProbeResult } from './probes';

const root = document.getElementById('spike');
if (!root) throw new Error('#spike 없음');

const results = new Map<string, ProbeResult>();
const mark = (ok: boolean | null) => (ok === null ? '❔' : ok ? '✅' : '❌');

function render() {
  const rows = [...results.values()]
    .map(
      (r) =>
        `<tr data-probe="${r.id}" data-ok="${String(r.ok)}"><td class="p-1">${mark(r.ok)}</td><td class="p-1">${r.label}</td><td class="p-1 font-mono text-xs" data-value>${r.value}</td></tr>`,
    )
    .join('');
  table.innerHTML = `<tbody>${rows}</tbody>`;
  (window as unknown as { __spike: ProbeResult[] }).__spike = [...results.values()];
}

root.className = 'mx-auto max-w-md p-4 pb-40 text-sm';
root.innerHTML = `
  <h1 class="mb-2 text-lg font-bold">모바일 스파이크</h1>
  <p class="mb-3 text-slate-600">아이폰 사파리에서 열고 아래를 차례로 해 보세요. ✅/❌는 "API가 있다"는 뜻일 뿐, 체감 동작은 직접 확인해야 합니다.</p>
  <table id="probes" class="mb-4 w-full border-collapse"></table>
  <div class="flex flex-wrap gap-2">
    <button id="audio" class="min-h-11 rounded bg-slate-800 px-3 text-white">④ 소리 내기</button>
    <button id="share" class="min-h-11 rounded bg-slate-800 px-3 text-white">⑤ 공유/복사</button>
  </div>
  <label class="mt-4 block">보안문자 입력 (키보드 테스트)
    <input id="captcha" inputmode="text" autocomplete="off" autocapitalize="characters" class="mt-1 block w-full rounded border p-2 text-base" />
  </label>
  <div id="seatmap" class="mt-4 grid grid-cols-8 gap-1 rounded border p-2" style="touch-action: manipulation">
    ${Array.from({ length: 32 }, (_, i) => `<button class="h-8 rounded-full bg-pink-200" aria-label="좌석 ${i + 1}"></button>`).join('')}
  </div>
  <p class="mt-2 text-xs text-slate-500">③ 위 좌석도에서 두 손가락 확대·더블탭을 해 보세요. 페이지가 확대되면 ❌.</p>
  <p class="mt-2 text-xs text-slate-500">② 페이지 맨 위에서 아래로 당겨 보세요. 새로고침되면 ❌.</p>
  <div id="dock" class="fixed inset-x-0 bottom-0 flex justify-center border-t bg-white/95 p-3">
    <button id="confirm" class="min-h-11 rounded bg-pink-600 px-6 font-bold text-white">입력완료</button>
  </div>
  <pre id="vvlog" class="mt-4 whitespace-pre-wrap font-mono text-xs text-slate-500"></pre>
`;

const table = root.querySelector<HTMLTableElement>('#probes')!;
for (const r of staticProbes()) results.set(r.id, r);
render();

// ① 키보드가 올라오면 하단 버튼을 visualViewport 아래쪽에 붙인다
const dock = root.querySelector<HTMLDivElement>('#dock')!;
const vvlog = root.querySelector<HTMLPreElement>('#vvlog')!;
const vv = window.visualViewport;
if (vv) {
  const place = () => {
    const covered = window.innerHeight - (vv.height + vv.offsetTop);
    dock.style.transform = `translateY(${-Math.max(0, covered)}px)`;
    vvlog.textContent = `visualViewport: h=${Math.round(vv.height)} top=${Math.round(vv.offsetTop)} inner=${window.innerHeight} 가림=${Math.round(covered)}px`;
    results.set('keyboardDock', {
      id: 'keyboardDock',
      label: '① 키보드 위로 하단 버튼 이동',
      value: `가림 ${Math.round(covered)}px 보정`,
      ok: null,
    });
    render();
  };
  vv.addEventListener('resize', place);
  vv.addEventListener('scroll', place);
  place();
}

// ③ iOS 사파리 제스처 줌 억제 시도 (비표준 이벤트)
document.addEventListener('gesturestart', (e) => e.preventDefault());

root.querySelector('#audio')!.addEventListener('click', () => {
  void unlockAudio().then((r) => {
    results.set(r.id, r);
    render();
  });
});
root.querySelector('#share')!.addEventListener('click', () => {
  void shareWithFallback('1분 전 · 스파이크 공유 테스트 #SPIKE').then((how) => {
    results.set('shareResult', {
      id: 'shareResult',
      label: '⑤ 공유 결과',
      value: how,
      ok: how !== 'failed',
    });
    render();
  });
});
