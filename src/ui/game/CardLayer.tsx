import { useState } from 'react';
import type { CardDef, CardRuntime, RunContext, RunState, Action } from '../../engine/types';
import { copy, hasCopy } from '../../content/copy';
import { SiteButton } from './parts';

type Send = (action: Action, target: string, value?: string) => void;

/**
 * 방해 카드 표시. 카드 데이터(effect.overlay·resolve)만 보고 그린다 — 카드별 코드 분기 없음.
 * 텔레그래프는 작은 예고, 활성은 overlay 종류대로.
 */
export function CardLayer({
  ctx,
  state,
  send,
  tutorial,
}: {
  ctx: RunContext;
  state: RunState;
  send: Send;
  tutorial: boolean;
}) {
  const live = state.cards.filter((c) => c.status === 'telegraph' || c.status === 'active');
  if (live.length === 0) return null;
  return (
    <>
      {live.map((c) => {
        const def = ctx.defs[c.idx];
        if (!def) return null;
        if (c.status === 'telegraph') return <Telegraph key={c.idx} />;
        return (
          <ActiveCard
            key={c.idx}
            c={c}
            def={def}
            ctx={ctx}
            send={send}
            hint={tutorial ? `tutorial.hint.card.${def.id}` : null}
          />
        );
      })}
    </>
  );
}

function Telegraph() {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute bottom-20 left-3 z-30 rounded-full bg-[var(--c-ink)] px-3 py-1 text-xs font-bold text-[var(--c-paper)] motion-safe:animate-pulse"
    >
      {copy('ui.card.incoming')}
    </div>
  );
}

const camel = (part: string) => part.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());

function buttonLabel(def: CardDef, part: string): string {
  return part === 'ok' ? copy('ui.card.ok') : copy(`${def.copyKey}.${camel(part)}`);
}

function ActiveCard({
  c,
  def,
  ctx,
  send,
  hint,
}: {
  c: CardRuntime;
  def: CardDef;
  ctx: RunContext;
  send: Send;
  hint: string | null;
}) {
  const target = (part: string) => `card:${c.idx}:${part}`;
  const title = copy(`${def.copyKey}.title`);
  const body = copy(`${def.copyKey}.body`);
  const r = def.resolve;
  const entry = ctx.schedule.entries[c.idx];

  const hintText =
    hint && hasCopy(hint) ? (
      <p
        data-testid="card-hint"
        className="rounded bg-[var(--c-surface)] px-2 py-1 text-xs font-bold text-[var(--c-ink)]"
      >
        {copy(hint)}
      </p>
    ) : null;
  const actions = (() => {
    switch (r.kind) {
      case 'tap':
        return (
          <SiteButton
            testId={`card-${c.idx}-${r.target}`}
            onClick={() => send('tap', target(r.target))}
            className="w-full"
          >
            {buttonLabel(def, r.target)}
          </SiteButton>
        );
      case 'choose':
        return (
          <div className="flex flex-col gap-2">
            {(entry?.optionOrder ?? r.options.map((o) => o.id)).map((id) => {
              const opt = r.options.find((o) => o.id === id);
              return opt ? (
                <SiteButton
                  key={id}
                  variant="quiet"
                  testId={`card-${c.idx}-opt-${id}`}
                  onClick={() => send('tap', target(`opt:${id}`))}
                >
                  {copy(opt.label)}
                </SiteButton>
              ) : null;
            })}
          </div>
        );
      case 'type':
        return (
          <TypeCard
            code={entry?.code ?? ''}
            onSubmit={(v) => send('type', target('submit'), v)}
            idx={c.idx}
          />
        );
      case 'avoid':
        // 단계 대상 미끼(새로고침 등)는 화면에 이미 있다. 카드 자신의 미끼만 그린다
        return r.target.startsWith('step') ? null : (
          <SiteButton
            variant="quiet"
            testId={`card-${c.idx}-${r.target}`}
            onClick={() => send('tap', target(r.target))}
          >
            {buttonLabel(def, r.target)}
          </SiteButton>
        );
      default:
        return null;
    }
  })();

  switch (def.effect.overlay) {
    case 'banner': {
      const tapPart = r.kind === 'ignore' ? r.target : null;
      return (
        <div
          className="absolute inset-x-3 top-3 z-30 flex flex-col gap-2 rounded-[var(--radius)] bg-[var(--c-ink)] p-3 text-[var(--c-paper)] shadow-lg"
          role="status"
        >
          <button
            type="button"
            data-testid={`card-${c.idx}-banner`}
            className="text-left"
            onClick={() => tapPart && send('tap', target(tapPart))}
          >
            <p className="text-xs opacity-80">{title}</p>
            <p className="text-sm">{body}</p>
          </button>
          {hintText}
          {actions}
        </div>
      );
    }
    case 'spinner':
      return (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[var(--c-paper)]/80"
          role="status"
        >
          <div className="h-10 w-10 rounded-full border-4 border-[var(--c-line)] border-t-[var(--c-primary)] motion-safe:animate-spin" />
          <p className="max-w-xs text-center text-sm">{body}</p>
        </div>
      );
    case 'keyboard':
      return (
        <div
          className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-2 bg-[var(--c-seatTaken)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          role="dialog"
          aria-label={title}
        >
          <div className="flex justify-end">{actions}</div>
          <div aria-hidden className="grid grid-cols-10 gap-1">
            {[...'ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔㅁㄴㅇㄹㅎㅗㅓㅏㅣ;ㅋㅌㅊㅍㅠㅜㅡ,./'].map((k, i) => (
              <span
                key={i}
                className="flex h-10 items-center justify-center rounded bg-[var(--c-paper)] text-sm"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      );
    case 'sheet':
      return (
        <div
          className="absolute inset-0 z-30 flex items-end bg-[var(--c-ink)]/40"
          role="dialog"
          aria-label={title}
        >
          <div className="w-full rounded-t-[var(--radius)] bg-[var(--c-paper)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="mb-1 font-bold">{title}</p>
            <p className="mb-3 text-sm text-[var(--c-muted)]">{body}</p>
            {actions}
          </div>
        </div>
      );
    case 'none':
      // 화면 효과 없이 단계에만 영향을 주는 카드 (좌석 가로채기 등). 예고만 보인다
      return null;
    case 'modal':
      return (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--c-ink)]/40 p-6"
          role="alertdialog"
          aria-label={title}
        >
          <div className="w-full max-w-sm rounded-[var(--radius)] bg-[var(--c-paper)] p-5 shadow-lg">
            <p className="mb-1 font-bold">{title}</p>
            <p className="mb-4 text-sm">{body}</p>
            {hintText && <div className="mb-3">{hintText}</div>}
            {actions}
          </div>
        </div>
      );
  }
}

function TypeCard({
  code,
  onSubmit,
  idx,
}: {
  code: string;
  onSubmit: (v: string) => void;
  idx: number;
}) {
  const [value, setValue] = useState('');
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <p
        data-testid={`card-${idx}-code`}
        data-code={code}
        className="rounded-[var(--radius)] bg-[var(--c-surface)] py-2 text-center text-2xl font-black tracking-[0.4em]"
      >
        {code}
      </p>
      <div className="flex gap-2">
        <input
          data-testid={`card-${idx}-input`}
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="min-h-11 min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--c-line)] px-3 text-base tracking-widest"
        />
        <SiteButton testId={`card-${idx}-submit`} onClick={() => onSubmit(value)}>
          {copy('ui.card.submit')}
        </SiteButton>
      </div>
    </form>
  );
}
