import { copy } from '../../content/copy';
import type { RunResult } from '../../engine/result';

/** 결과 화면 (M2 기본형 — M3에서 원인 한 줄·타임라인·공유 추가) */
export function ResultScreen({
  result,
  onAgain,
  onRevenge,
  onHome,
}: {
  result: RunResult;
  onAgain: () => void;
  onRevenge: () => void;
  onHome: () => void;
}) {
  const win = result.outcome === 'success';
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))] text-game-ink">
      <p className={`text-sm font-bold ${win ? 'text-game-ink' : 'text-game-danger'}`}>
        {copy(win ? 'ui.result.success' : 'ui.result.fail')}
      </p>
      <h1 data-testid="result-title" className="text-4xl font-black leading-tight">
        {copy(result.title)}
      </h1>
      {result.line && <p className="text-lg">{copy(result.line)}</p>}
      {win && (
        <p className="text-game-muted">
          {copy('ui.result.remaining', { s: (result.remainingTicks / 20).toFixed(1) })}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          data-testid="again"
          onClick={onAgain}
          className="min-h-14 rounded-xl bg-game-accent text-lg font-bold text-game-paper"
        >
          {copy('ui.result.again')}
        </button>
        <button
          type="button"
          data-testid="revenge"
          onClick={onRevenge}
          className="min-h-12 rounded-xl border border-game-line bg-game-paper font-bold"
        >
          {copy('ui.result.revenge')}
        </button>
        <button type="button" onClick={onHome} className="min-h-11 text-sm text-game-muted">
          {copy('ui.result.home')}
        </button>
      </div>
    </main>
  );
}
