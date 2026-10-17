import { useState } from 'react';
import { copy } from '../../content/copy';
import type { RunResult, TimelineItem } from '../../engine/result';
import type { RunContext } from '../../engine/types';
import { emojiTimeline } from '../share';

/** 결과 화면 (difficulty §2.2): 큰 칭호 + 한 줄 원인 → 타임라인 → 조합 → 버튼 */
export function ResultScreen({
  ctx,
  result,
  code,
  onAgain,
  onRevenge,
  onShare,
  onNext,
  onHome,
}: {
  ctx: RunContext;
  result: RunResult;
  code: string;
  onAgain: () => void;
  onRevenge: () => void;
  onShare: () => Promise<string>;
  onNext: (() => void) | null;
  onHome: () => void;
}) {
  const [shareNote, setShareNote] = useState<string | null>(null);
  const win = result.outcome === 'success';
  const step = ctx.stage.steps.find((s) => s.id === result.endStepId);
  const stepName = step ? copy(step.title) : '';
  const cause =
    result.reason === 'done'
      ? copy('ui.cause.done', { s: (result.remainingTicks / 20).toFixed(1) })
      : result.reason === 'timeout'
        ? copy('ui.cause.timeout', { step: stepName })
        : result.reason === 'stepTimeout'
          ? copy('ui.cause.stepTimeout', { step: stepName })
          : copy('ui.cause.fatal');

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 pb-8 pt-[max(2.5rem,env(safe-area-inset-top))] text-game-ink">
      <header className="flex flex-col gap-3">
        <p className={`text-sm font-bold ${win ? 'text-game-ink' : 'text-game-danger'}`}>
          {copy(win ? 'ui.result.success' : 'ui.result.fail')}
        </p>
        <h1 data-testid="result-title" className="text-4xl font-black leading-tight">
          {copy(result.title)}
        </h1>
        {result.line && <p className="text-lg">{copy(result.line)}</p>}
        <p data-testid="result-cause" className="text-game-muted">
          {cause}
        </p>
        <div className="flex items-center justify-between text-sm text-game-muted">
          <span
            aria-label={copy('ui.result.stars', { n: result.stars })}
            className="text-xl tracking-widest text-game-accent"
          >
            {'★'.repeat(result.stars)}
            <span className="text-game-line">{'★'.repeat(3 - result.stars)}</span>
          </span>
          <span>
            {ctx.stage.tutorial ? `#${code}` : copy('ui.result.seed', { code, level: ctx.level })}
          </span>
        </div>
      </header>

      {result.timeline.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-game-muted">{copy('ui.result.timeline')}</h2>
          <TimelineBar
            items={result.timeline}
            duration={ctx.durationTicks}
            end={ctx.durationTicks - result.remainingTicks}
          />
          <p data-testid="result-emoji" className="text-xl tracking-wide">
            {emojiTimeline(result)}
          </p>
        </section>
      )}

      {result.synergies.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-bold text-game-muted">{copy('ui.result.synergy')}</h2>
          {result.synergies.map((s) => (
            <p key={s} className="font-bold">
              {copy(s)}
            </p>
          ))}
        </section>
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
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="revenge"
            onClick={onRevenge}
            className="min-h-12 rounded-xl border border-game-line bg-game-paper font-bold"
          >
            {copy('ui.result.revenge')}
          </button>
          <button
            type="button"
            data-testid="share"
            onClick={() => void onShare().then(setShareNote)}
            className="min-h-12 rounded-xl border border-game-line bg-game-paper font-bold"
          >
            {copy('ui.result.share')}
          </button>
        </div>
        {shareNote && (
          <p
            data-testid="share-note"
            className="text-center text-sm text-game-muted"
            aria-live="polite"
          >
            {shareNote}
          </p>
        )}
        {onNext && (
          <button
            type="button"
            data-testid="next-stage"
            onClick={onNext}
            className="min-h-12 rounded-xl bg-game-ink font-bold text-game-paper"
          >
            {copy('ui.result.next')}
          </button>
        )}
        <button type="button" onClick={onHome} className="min-h-11 text-sm text-game-muted">
          {copy('ui.result.home')}
        </button>
      </div>
    </main>
  );
}

/** 60초 막대 위에 카드가 켜진 구간. 겹치면 줄을 나눈다 */
function TimelineBar({
  items,
  duration,
  end,
}: {
  items: readonly TimelineItem[];
  duration: number;
  end: number;
}) {
  const lanes: number[] = [];
  const placed = [...items]
    .sort((a, b) => a.start - b.start)
    .map((t) => {
      let lane = lanes.findIndex((until) => until <= t.start);
      if (lane < 0) lane = lanes.length;
      lanes[lane] = t.end;
      return { t, lane };
    });
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / duration) * 100))}%`;
  const color = (t: TimelineItem) =>
    t.status === 'failed'
      ? 'bg-game-danger'
      : t.status === 'resolved'
        ? t.late
          ? 'bg-game-late'
          : 'bg-game-ok'
        : 'bg-game-line';
  return (
    <div
      className="relative rounded-lg bg-game-paper p-2"
      style={{ height: `${Math.max(1, lanes.length) * 14 + 16}px` }}
    >
      <div className="absolute inset-y-2 left-2 right-2">
        <div className="absolute inset-y-0 w-0.5 bg-game-ink" style={{ left: pct(end) }} />
        {placed.map(({ t, lane }) => (
          <div
            key={t.idx}
            className={`absolute h-2.5 rounded-full ${color(t)}`}
            style={{
              left: pct(t.start),
              width: `max(6px, ${pct(t.end - t.start)})`,
              top: `${lane * 14}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
