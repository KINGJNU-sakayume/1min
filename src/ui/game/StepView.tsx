import { useEffect, useState } from 'react';
import { seatView, zoneSeatIds } from '../../engine/steps/seatMap';
import type { Action, RunContext, RunState, StepJson } from '../../engine/types';
import { copy } from '../../content/copy';
import type { ThemeJson } from '../../../content/schema/theme';
import type { LayoutMode } from '../useLayoutMode';
import { Panel, SitePopup, SiteButton } from './parts';

type Send = (action: Action, target: string, value?: string) => void;

interface Props {
  ctx: RunContext;
  state: RunState;
  send: Send;
  mode: LayoutMode;
  theme: ThemeJson;
}

/** 현재 단계 화면. 단계 kind → 컴포넌트 (엔진 핸들러와 1:1) */
export function StepView(props: Props) {
  const def = props.ctx.stage.steps[props.state.stepIndex];
  if (!def) return null;
  switch (def.kind) {
    case 'openButton':
      return <OpenStep {...props} />;
    case 'queue':
      return <QueueStep {...props} def={def} />;
    case 'textInput':
      return <TextStep {...props} def={def} />;
    case 'seatMap':
      return <SeatStep {...props} def={def} />;
    case 'quantity':
      return <QuantityStep {...props} def={def} />;
    case 'payment':
      return <PaymentStep {...props} def={def} />;
    case 'choose':
      return <ChooseStep {...props} def={def} />;
    case 'hold':
      return <HoldStep {...props} />;
    case 'confirm':
      return (
        <Panel>
          <SiteButton onClick={() => props.send('tap', 'step:confirm')} className="w-full">
            {copy(def.title)}
          </SiteButton>
        </Panel>
      );
  }
}

type DefOf<K extends StepJson['kind']> = Extract<StepJson, { kind: K }>;

/** 정각 전 가상 서버 시계: T0 = 20:00:00.0 */
function serverClock(tick: number, t0: number): string {
  const ms = (tick - t0) * 50;
  const total = 20 * 3600 * 1000 + ms;
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const d = Math.floor((total % 1000) / 100);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${d}`;
}

function OpenStep({ ctx, state, send }: Props) {
  const open = state.phase === 'RUNNING';
  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-3">
        <div className="flex gap-4">
          <div
            aria-hidden
            className="h-28 w-20 shrink-0 rounded-[var(--radius)] bg-[var(--c-primary)]"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm text-[var(--c-muted)]">{copy('brand.ticketing.band')}</p>
            <h2 className="text-lg font-bold leading-snug">{copy('brand.ticketing.show')}</h2>
            <p className="text-sm text-[var(--c-muted)]">{copy('brand.ticketing.venue')}</p>
            <p className="text-sm text-[var(--c-muted)]">{copy('ui.open.seats')}</p>
          </div>
        </div>
        <div className="flex items-baseline justify-between border-t border-[var(--c-line)] pt-3 text-sm">
          <span className="text-[var(--c-muted)]">{copy('ui.open.serverTime')}</span>
          <span className="font-bold tabular-nums">{serverClock(state.tick, ctx.t0)}</span>
        </div>
        <p className="text-sm">{copy('ui.open.opensAt')}</p>
      </Panel>
      <SiteButton
        testId="open"
        variant={open ? 'primary' : 'muted'}
        onClick={() => send('open', 'step:open')}
        className="h-14 w-full text-lg"
      >
        {open ? copy('ui.open.button') : copy('ui.open.before')}
      </SiteButton>
    </div>
  );
}

function QueueStep({ state, send, theme }: Props & { def: DefOf<'queue'> }) {
  if (state.step.kind !== 'queue') return null;
  const count = Math.ceil(state.step.count);
  const progress = 1 - state.step.count / Math.max(state.step.initial, state.step.count);
  const above = theme.layout.queueNoticePosition === 'above';
  const notice = <p className="text-sm text-[var(--c-muted)]">{copy('ui.queue.notice')}</p>;
  return (
    <Panel className="flex flex-col items-center gap-4 py-8 text-center">
      <h2 className="text-lg font-bold">{copy('ui.queue.title')}</h2>
      {above && notice}
      <p data-testid="queue-count" className="text-base">
        {copy('ui.queue.ahead', { n: count.toLocaleString('ko-KR') })}
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--c-line)]">
        <div
          className="h-full bg-[var(--c-primary)]"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      {!above && notice}
      <SiteButton variant="quiet" onClick={() => send('tap', 'step:refresh')} testId="refresh">
        {copy('ui.queue.refresh')}
      </SiteButton>
    </Panel>
  );
}

/** 보안문자 이미지 흉내: 글자마다 기울기·높이를 코드에서 결정적으로 뽑는다 (연출 전용) */
function Captcha({ code }: { code: string }) {
  return (
    <div
      aria-label={code}
      data-testid="captcha"
      data-code={code}
      className="flex select-none items-center justify-center gap-1 rounded-[var(--radius)] border border-[var(--c-line)] bg-[repeating-linear-gradient(135deg,var(--c-surface),var(--c-surface)_6px,var(--c-paper)_6px,var(--c-paper)_12px)] px-4 py-3"
    >
      {[...code].map((ch, i) => {
        const h = (code.charCodeAt(i) * 37 + i * 101) % 41;
        return (
          <span
            key={i}
            className="inline-block text-3xl font-black text-[var(--c-ink)]"
            style={{
              transform: `rotate(${h - 20}deg) translateY(${(h % 9) - 4}px)`,
              opacity: 0.75 + (h % 5) / 20,
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}

function TextStep({ state, send, def }: Props & { def: DefOf<'textInput'> }) {
  const local = state.step.kind === 'textInput' ? state.step : null;
  const [value, setValue] = useState('');
  const clearSeq = local?.clearSeq ?? 0;
  useEffect(() => {
    // 오입력·생년월일 오류 카드가 오면 입력칸을 비운다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue('');
  }, [clearSeq]);
  if (!local) return null;
  const digits = /^[0-9]+$/.test(def.input.alphabet);
  const submit = () => send('type', 'step:submit', value);
  return (
    <Panel className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">{copy(def.title)}</h2>
      <p className="text-sm text-[var(--c-muted)]">{copy(def.input.prompt)}</p>
      {digits ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[var(--c-muted)]">{copy('ui.text.buyerLabel')}</dt>
          <dd>{copy('brand.ticketing.buyer')}</dd>
          <dt className="text-[var(--c-muted)]">{copy('ui.text.birthLabel')}</dt>
          <dd
            data-testid="birth"
            data-code={local.code}
            className="font-bold tabular-nums tracking-widest"
          >
            {local.code}
          </dd>
        </dl>
      ) : (
        <Captcha code={local.code} />
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          data-testid="text-input"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          inputMode={digits ? 'numeric' : 'text'}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={def.input.length.max}
          placeholder={copy('ui.text.placeholder')}
          aria-label={copy(def.title)}
          className="min-h-11 min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--c-line)] px-3 text-base tracking-widest"
        />
        <SiteButton testId="text-submit" onClick={submit}>
          {digits ? copy('ui.text.next') : copy('ui.text.submit')}
        </SiteButton>
      </form>
    </Panel>
  );
}

function SeatStep({ state, send, mode, theme, def }: Props & { def: DefOf<'seatMap'> }) {
  if (state.step.kind !== 'seatMap') return null;
  const local = state.step;
  const zones = def.seatMap.zones;
  const zone = zones.find((z) => z.id === local.zone) ?? zones[0];
  if (!zone) return null;
  const floors = [...new Set(zones.map((z) => z.floor))];
  const shape = { jellybean: 'rounded-[999px]', circle: 'rounded-full', square: 'rounded-sm' }[
    theme.layout.seatShape
  ];
  const seatColor = {
    free: 'bg-[var(--c-seatFree)]',
    taken: 'bg-[var(--c-seatTaken)]',
    mine: 'bg-[var(--c-seatMine)]',
  };

  const map = (
    <div className="flex flex-col gap-3">
      <div className="rounded-[var(--radius)] bg-[var(--c-ink)] py-1 text-center text-xs text-[var(--c-paper)]">
        {copy('ui.seat.stage')}
      </div>
      <div
        className={`mx-auto grid w-full gap-1 ${mode === 'pc' ? 'max-w-md' : 'max-w-xs'}`}
        style={{ gridTemplateColumns: `repeat(${zone.cols}, minmax(0, 1fr))` }}
      >
        {zoneSeatIds(zone).map((id) => {
          const view = seatView(local, id, state.tick, def.seatMap.revealLagTicks);
          return (
            <button
              key={id}
              type="button"
              data-testid={`seat-${id}`}
              data-view={view}
              aria-label={`${id} ${copy(view === 'free' ? 'ui.seat.legendFree' : view === 'taken' ? 'ui.seat.legendTaken' : 'ui.seat.legendMine')}`}
              onClick={() => view !== 'taken' && send('tap', `step:seat:${id}`)}
              className={`aspect-[4/5] min-h-6 ${shape} ${seatColor[view]}`}
            />
          );
        })}
      </div>
      <ul className="flex gap-4 text-xs text-[var(--c-muted)]">
        {(['free', 'taken', 'mine'] as const).map((v) => (
          <li key={v} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 ${shape} ${seatColor[v]}`} />
            {copy(
              v === 'free'
                ? 'ui.seat.legendFree'
                : v === 'taken'
                  ? 'ui.seat.legendTaken'
                  : 'ui.seat.legendMine',
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  const zonePicker = (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {floors.map((f) => (
          <SiteButton
            key={f}
            variant={zone.floor === f ? 'primary' : 'quiet'}
            className="flex-1"
            onClick={() => {
              const first = zones.find((z) => z.floor === f);
              if (first) send('tap', `step:zone:${first.id}`);
            }}
          >
            {copy('ui.seat.floor', { n: f })}
          </SiteButton>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {zones
          .filter((z) => z.floor === zone.floor)
          .map((z) => {
            const free = zoneSeatIds(z).filter(
              (id) => seatView(local, id, state.tick, def.seatMap.revealLagTicks) === 'free',
            ).length;
            return (
              <button
                key={z.id}
                type="button"
                data-testid={`zone-${z.id}`}
                onClick={() => send('tap', `step:zone:${z.id}`)}
                className={`flex min-h-11 items-center justify-between rounded-[var(--radius)] border px-3 text-sm ${z.id === zone.id ? 'border-[var(--c-primary)] font-bold' : 'border-[var(--c-line)]'}`}
              >
                <span>{copy(z.label)}</span>
                <span className="tabular-nums text-[var(--c-muted)]">{free}</span>
              </button>
            );
          })}
      </div>
    </div>
  );

  const confirm = (
    <SiteButton
      testId="seat-confirm"
      onClick={() => send('tap', 'step:confirm')}
      className="w-full"
    >
      {copy('ui.seat.confirm')}
    </SiteButton>
  );
  const selected = (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-[var(--c-muted)]">{copy('ui.seat.selected')}</span>
      <span className="font-bold">{local.selected ?? copy('ui.seat.none')}</span>
    </div>
  );

  return (
    <div className="relative">
      {mode === 'pc' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'var(--pc-main) 1fr' }}>
          <Panel>{map}</Panel>
          <Panel className="flex flex-col gap-3">
            {zonePicker}
            <div className="border-t border-[var(--c-line)] pt-2">{selected}</div>
            {confirm}
          </Panel>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-28">
          <Panel>{zonePicker}</Panel>
          <Panel>{map}</Panel>
          <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t border-[var(--c-line)] bg-[var(--c-paper)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            {selected}
            {confirm}
          </div>
        </div>
      )}
      {local.popup === 'conflict' && (
        <SitePopup onOk={() => send('tap', 'step:seat-ok')} okLabel={copy('ui.seat.ok')}>
          {copy('ui.seat.conflict')}
        </SitePopup>
      )}
    </div>
  );
}

function QuantityStep({ state, send, def }: Props & { def: DefOf<'quantity'> }) {
  if (state.step.kind !== 'quantity') return null;
  const local = state.step;
  return (
    <Panel className="relative flex flex-col gap-4">
      <h2 className="text-lg font-bold">{copy(def.title)}</h2>
      <div className="flex items-center justify-between gap-2 border-y border-[var(--c-line)] py-3">
        <div>
          <p className="font-bold">{copy('ui.price.ticket')}</p>
          <p className="text-sm text-[var(--c-muted)]">{copy('ui.price.amount')}</p>
        </div>
        <div className="flex items-center gap-1">
          <SiteButton
            variant="quiet"
            onClick={() => send('tap', 'step:qty-minus')}
            className="w-11 px-0"
          >
            −
          </SiteButton>
          <span data-testid="qty" className="w-12 text-center font-bold tabular-nums">
            {copy('ui.price.qty', { n: local.qty })}
          </span>
          <SiteButton
            testId="qty-plus"
            variant="quiet"
            onClick={() => send('tap', 'step:qty-plus')}
            className="w-11 px-0"
          >
            +
          </SiteButton>
        </div>
      </div>
      <SiteButton testId="price-next" onClick={() => send('tap', 'step:next')} className="w-full">
        {copy('ui.price.next')}
      </SiteButton>
      {local.popup === 'zero' && (
        <SitePopup onOk={() => send('tap', 'step:popup-ok')} okLabel={copy('ui.price.ok')}>
          {copy('ui.price.zero')}
        </SitePopup>
      )}
    </Panel>
  );
}

function PaymentStep({ state, send, def }: Props & { def: DefOf<'payment'> }) {
  if (state.step.kind !== 'payment') return null;
  const local = state.step;
  const left = Math.max(0, (state.stepDeadline ?? state.tick) - state.tick);
  const virtualSec = Math.ceil((left * 50 * def.payment.displayScale) / 1000);
  const mmss = `${String(Math.floor(virtualSec / 60)).padStart(2, '0')}:${String(virtualSec % 60).padStart(2, '0')}`;
  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">{copy(def.title)}</h2>
        <span className="text-sm">
          <span className="text-[var(--c-muted)]">{copy('ui.pay.timer')} </span>
          <span data-testid="pay-timer" className="font-bold tabular-nums text-[var(--c-danger)]">
            {mmss}
          </span>
        </span>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-[var(--c-muted)]">{copy('ui.pay.method')}</legend>
        {def.payment.methods.map((m) => (
          <label
            key={m.id}
            className="flex min-h-11 items-center gap-3 rounded-[var(--radius)] border border-[var(--c-line)] px-3"
          >
            <input
              type="radio"
              name="method"
              data-testid={`method-${m.id}`}
              checked={local.method === m.id}
              onChange={() => send('tap', `step:method:${m.id}`)}
            />
            {copy(m.label)}
          </label>
        ))}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          data-testid="agree"
          checked={local.agreed}
          onChange={() => send('tap', 'step:agree')}
        />
        {copy('ui.pay.agree')}
      </label>
      <SiteButton
        testId="pay"
        onClick={() => send('tap', 'step:pay')}
        className="h-14 w-full text-lg"
      >
        {copy('ui.pay.button')}
      </SiteButton>
      <p className="text-center text-xs text-[var(--c-muted)]">{copy('ui.pay.fakeNote')}</p>
    </Panel>
  );
}

function ChooseStep({ state, send, def }: Props & { def: DefOf<'choose'> }) {
  if (state.step.kind !== 'choose') return null;
  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{copy(def.title)}</h2>
      {state.step.order.map((id) => {
        const opt = def.choose.options.find((o) => o.id === id);
        return opt ? (
          <SiteButton
            key={id}
            variant="quiet"
            testId={`opt-${id}`}
            onClick={() => send('tap', `step:opt:${id}`)}
          >
            {copy(opt.label)}
          </SiteButton>
        ) : null;
      })}
    </Panel>
  );
}

function HoldStep({ state, send }: Props) {
  const [pressedAt, setPressedAt] = useState<number | null>(null);
  return (
    <Panel>
      <button
        type="button"
        className="min-h-14 w-full rounded-[var(--radius)] bg-[var(--c-primary)] font-bold text-[var(--c-primaryInk)]"
        onPointerDown={() => setPressedAt(state.tick)}
        onPointerUp={() => {
          if (pressedAt !== null) send('hold', 'step:hold', String(state.tick - pressedAt));
          setPressedAt(null);
        }}
        onPointerLeave={() => setPressedAt(null)}
      >
        {copy('ui.card.ok')}
      </button>
    </Panel>
  );
}
