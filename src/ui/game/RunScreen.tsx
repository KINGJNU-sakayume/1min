import { useCallback, useEffect, useMemo, useState } from 'react';
import { remainingTicks } from '../../engine/reducer';
import type { EngineEvent, Input, RunContext, RunState } from '../../engine/types';
import { copy, hasCopy } from '../../content/copy';
import { loadContent } from '../../content/load';
import { playFeedback, unlockAudio } from '../feedback';
import { themeStyle } from '../theme';
import { useLayoutMode } from '../useLayoutMode';
import { CardLayer } from './CardLayer';
import { StepView } from './StepView';
import { SiteButton } from './parts';
import { useRunEngine } from './useRunEngine';

interface Toast {
  text: string;
  until: number;
}

const TOAST_TICKS = 30;

function toastFor(e: EngineEvent): string | null {
  if (e.type === 'judgment') return copy(`ui.judgment.${e.judgment}`);
  if (e.type === 'early') return copy('ui.judgment.EARLY');
  // 좌석 충돌은 화면 팝업이 이미 알려 준다
  if (e.type === 'notice' && e.key !== 'seat.conflict') return copy(`ui.notice.${e.key}`);
  if (e.type === 'synergy') return copy(e.name);
  return null;
}

export function RunScreen({
  ctx,
  muted,
  onFinish,
}: {
  ctx: RunContext;
  muted: boolean;
  onFinish: (state: RunState, inputs: readonly Input[]) => void;
}) {
  const theme = useMemo(() => {
    const t = loadContent().themes.get(ctx.stage.theme.tokens);
    if (!t) throw new Error(`테마 없음: ${ctx.stage.theme.tokens}`);
    return t;
  }, [ctx]);
  const mode = useLayoutMode();
  const [toast, setToast] = useState<Toast | null>(null);
  const onEvents = useCallback(
    (events: EngineEvent[], s: RunState) => {
      playFeedback(events, muted);
      for (const e of events) {
        const text = toastFor(e);
        if (text) setToast({ text, until: s.tick + TOAST_TICKS });
      }
    },
    [muted],
  );
  const engine = useRunEngine(ctx, onEvents);
  const { state, send, getInputs } = engine;

  useEffect(() => {
    if (state.phase !== 'RESULT') return;
    const id = window.setTimeout(() => onFinish(state, getInputs()), 900);
    return () => window.clearTimeout(id);
  }, [state, onFinish, getInputs]);

  const left =
    state.phase === 'RUNNING' || state.phase === 'RESULT'
      ? remainingTicks(ctx, state)
      : ctx.durationTicks;
  const steps = ctx.stage.steps;
  const locked = state.tick < state.lockUntil;
  const stepDef = steps[state.stepIndex];
  const urlKey = ctx.stage.brand.name.replace(/\.name$/, '.url');
  const hint = ctx.stage.tutorial && stepDef ? `tutorial.hint.${stepDef.id}` : null;

  const site = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--c-surface)]">
      <header className="flex items-center gap-3 border-b border-[var(--c-line)] bg-[var(--c-paper)] px-4 py-2">
        <span className="font-black tracking-tight text-[var(--c-primary)]">
          {copy(ctx.stage.brand.name)}
        </span>
        <span className="truncate text-sm text-[var(--c-muted)]">
          {stepDef ? copy(stepDef.title) : ''}
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" data-testid="site">
        <div className={`flex flex-col gap-3 ${mode === 'pc' ? 'mx-auto max-w-4xl' : ''}`}>
          {hint && hasCopy(hint) && state.phase === 'RUNNING' && (
            <p
              data-testid="hint"
              className="rounded-[var(--radius)] border-2 border-dashed border-[var(--c-primary)] bg-[var(--c-paper)] p-3 text-sm font-bold"
            >
              {copy(hint)}
            </p>
          )}
          <StepView ctx={ctx} state={state} send={send} mode={mode} theme={theme} />
        </div>
      </div>
      <CardLayer ctx={ctx} state={state} send={send} tutorial={ctx.stage.tutorial === true} />
      {locked && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--c-paper)]/70"
          role="status"
        >
          <p className="rounded-[var(--radius)] bg-[var(--c-ink)] px-4 py-2 text-sm text-[var(--c-paper)]">
            {copy('ui.lock')}
          </p>
        </div>
      )}
      {toast && state.tick < toast.until && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center"
          aria-live="polite"
        >
          <p className="rounded-full bg-[var(--c-ink)] px-4 py-2 text-sm font-bold text-[var(--c-paper)] shadow-lg">
            {toast.text}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-game-bg text-[var(--c-ink)]" style={themeStyle(theme)}>
      <Hud
        left={left}
        total={ctx.durationTicks}
        stepIndex={state.stepIndex}
        stepCount={steps.length}
        mode={mode}
      />
      {mode === 'pc' ? (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-xl border border-game-line bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-game-line bg-game-chrome px-3 py-2">
              <span aria-hidden className="flex gap-1.5">
                <i className="h-3 w-3 rounded-full bg-game-line" />
                <i className="h-3 w-3 rounded-full bg-game-line" />
                <i className="h-3 w-3 rounded-full bg-game-line" />
              </span>
              <span className="ml-2 flex-1 truncate rounded-md bg-white px-3 py-1 text-xs text-game-muted">
                {hasCopy(urlKey) ? copy(urlKey) : ''}
              </span>
            </div>
            {site}
          </div>
        </div>
      ) : (
        site
      )}
      <p className="px-4 py-1 text-center text-[11px] text-game-muted">
        {copy(ctx.stage.brand.disclaimer)}
      </p>
      {state.phase === 'READY' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-game-ink/60 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center">
            <h2 className="mb-2 text-xl font-bold">{copy('ui.ready.title')}</h2>
            <p className="mb-5 text-sm text-game-muted">{copy('ui.ready.body')}</p>
            <SiteButton
              testId="ready"
              className="w-full"
              onClick={() => {
                unlockAudio();
                engine.start();
              }}
            >
              {copy('ui.ready.go')}
            </SiteButton>
          </div>
        </div>
      )}
    </div>
  );
}

/** 게임 쪽 HUD: 남은 시간이 이 화면의 주인공이다 */
function Hud({
  left,
  total,
  stepIndex,
  stepCount,
  mode,
}: {
  left: number;
  total: number;
  stepIndex: number;
  stepCount: number;
  mode: 'pc' | 'mobile';
}) {
  const sec = Math.max(0, left) / 20;
  const danger = sec <= 10;
  const text = `${String(Math.floor(sec)).padStart(2, '0')}.${Math.floor((sec % 1) * 10)}`;
  return (
    <div className="flex items-center gap-4 bg-white px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-game-line">
      <div className="flex flex-col">
        <span className="text-[11px] text-game-muted">{copy('ui.hud.remaining')}</span>
        <span
          data-testid="timer"
          className={`font-black leading-none tabular-nums ${mode === 'pc' ? 'text-5xl' : 'text-4xl'} ${danger ? 'text-game-danger' : 'text-game-ink'}`}
        >
          {text}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-game-line">
          <div
            className={`h-full ${danger ? 'bg-game-danger' : 'bg-game-ink'}`}
            style={{ width: `${Math.max(0, Math.min(100, (left / total) * 100))}%` }}
          />
        </div>
        <ol
          className="flex gap-1"
          aria-label={copy('ui.step.progress', { i: stepIndex + 1, n: stepCount })}
        >
          {Array.from({ length: stepCount }, (_, i) => (
            <li
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < stepIndex ? 'bg-game-ink' : i === stepIndex ? 'bg-game-accent' : 'bg-game-line'}`}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
