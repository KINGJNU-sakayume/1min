import { createInitialState, isStepPattern, matchesTarget, step } from '../reducer';
import { seatView, zoneSeatIds } from '../steps/seatMap';
import type { Action, Input, RunContext, RunState } from '../types';

/**
 * 솔버 봇 (hazard-system §5.6): 화면에 보이는 정보만으로 "최선의 사람"처럼 둔다.
 * - 반응 지연(reactionTicks) 뒤에만 카드에 대응하고, 행동 사이 최소 간격(actionGapTicks)을 지킨다.
 * - 미끼(새로고침, 새 탭, 알림)는 건드리지 않고, 광클 제한을 넘지 않는다.
 * - 경쟁자가 가져간 좌석은 화면 반영 지연 뒤에야 안다 (숨은 정보 사용 금지).
 * 같은 봇에 반응을 느리게 주면 튜토리얼의 "안내대로만 하는" 봇이 된다.
 */

export interface BotParams {
  reactionTicks: number;
  actionGapTicks: number;
  /** 글자 하나 입력에 드는 틱 (보안문자·생년월일) */
  typeTicksPerChar: number;
  /** 정각 후 "예매하기"를 누르기까지의 틱 */
  openDelayTicks: number;
  /** 새 단계 화면을 읽는 틱 (진입 후 이만큼은 단계 입력을 하지 않는다) */
  stepReadTicks: number;
}

interface BotMemory {
  lastAction: number;
  hold: { target: string; start: number } | null;
  /** 지금 입력 중인 대상과 다 치는 틱 */
  typing: { target: string; value: string; readyAt: number } | null;
}

export function playWithBot(
  ctx: RunContext,
  params: BotParams,
): { state: RunState; inputs: Input[] } {
  const inputs: Input[] = [];
  const mem: BotMemory = { lastAction: -Infinity, hold: null, typing: null };
  let state = createInitialState(ctx);
  const limit = ctx.t0 + ctx.durationTicks + 2;
  while (state.phase !== 'RESULT' && state.tick <= limit) {
    const acts = botPolicy(ctx, state, mem, params);
    inputs.push(...acts);
    const before = state;
    state = step(ctx, state, acts).state;
    if (before.phase === 'READY' && state.phase === 'READY') break;
  }
  return { state, inputs };
}

export function botPolicy(ctx: RunContext, s: RunState, mem: BotMemory, p: BotParams): Input[] {
  const t = s.tick;
  if (s.phase === 'READY') return [{ tick: t, action: 'start', target: 'run' }];
  if (s.phase === 'RESULT' || t < s.lockUntil) return [];

  const act = (action: Action, target: string, value?: string): Input[] => {
    mem.lastAction = t;
    return [value === undefined ? { tick: t, action, target } : { tick: t, action, target, value }];
  };

  // 길게 누르기는 진행 중이면 간격과 무관하게 끝까지 유지한다
  if (mem.hold) {
    const held = t - mem.hold.start;
    const need = holdNeed(ctx, s, mem.hold.target);
    if (need === null) mem.hold = null;
    else if (held >= need) {
      const target = mem.hold.target;
      mem.hold = null;
      return act('hold', target, String(held));
    } else return [];
  }
  if (t - mem.lastAction < p.actionGapTicks) return [];

  /** 글자를 다 칠 때까지 기다렸다가 제출한다. 대상·값이 바뀌면 처음부터 */
  const typeOut = (target: string, value: string): Input[] => {
    if (!mem.typing || mem.typing.target !== target || mem.typing.value !== value) {
      mem.typing = { target, value, readyAt: t + value.length * p.typeTicksPerChar };
    }
    if (t < mem.typing.readyAt) return [];
    mem.typing = null;
    return act('type', target, value);
  };

  const live = s.cards.filter((c) => c.status === 'active');
  let stepBlocked = false;
  for (const c of live) {
    const def = ctx.defs[c.idx];
    const entry = ctx.schedule.entries[c.idx];
    if (!def || !entry) continue;
    if (def.effect.blocksStep) stepBlocked = true;
    if (def.resolve.kind === 'avoid' && isStepPattern(def.resolve.target)) stepBlocked = true;
    if (c.activeAt === null || t < c.activeAt + p.reactionTicks) continue;
    const r = def.resolve;
    if (r.kind === 'tap') return act('tap', `card:${c.idx}:${r.target}`);
    if (r.kind === 'type') return typeOut(`card:${c.idx}:submit`, entry.code ?? '');
    if (r.kind === 'choose') {
      const ok = r.options.find((o) => o.correct);
      if (ok) return act('tap', `card:${c.idx}:opt:${ok.id}`);
    }
    if (r.kind === 'hold') {
      mem.hold = { target: `card:${c.idx}:${r.target}`, start: t };
      return [];
    }
  }
  if (stepBlocked) return [];

  // 광클 제한: 활성 rateLimit 카드의 창 안 탭 수를 넘기지 않는다
  const allowed = (target: string) =>
    live.every((c) => {
      const rl = ctx.defs[c.idx]?.effect.rateLimit;
      if (!rl || !matchesTarget(target, rl.target)) return true;
      return c.taps.filter((x) => t - x < rl.windowTicks).length + 1 <= rl.maxTaps;
    });
  const stepAct = (action: Action, target: string, value?: string) =>
    allowed(target) ? act(action, target, value) : [];

  const def = ctx.stage.steps[s.stepIndex];
  if (!def) return [];
  if (def.kind !== 'openButton' && t < s.stepEnteredAt + p.stepReadTicks) return [];
  const local = s.step;
  switch (def.kind) {
    case 'openButton':
      return t >= ctx.t0 + p.openDelayTicks ? stepAct('open', 'step:open') : [];
    case 'queue':
      return [];
    case 'textInput':
      return local.kind === 'textInput' && allowed('step:submit')
        ? typeOut('step:submit', local.code)
        : [];
    case 'seatMap': {
      if (local.kind !== 'seatMap') return [];
      if (local.popup) return stepAct('tap', 'step:seat-ok');
      if (local.selected) return stepAct('tap', 'step:confirm');
      const lag = def.seatMap.revealLagTicks;
      const freeIn = (zoneId: string) => {
        const zone = def.seatMap.zones.find((z) => z.id === zoneId);
        return zone ? zoneSeatIds(zone).filter((id) => seatView(local, id, t, lag) === 'free') : [];
      };
      const here = freeIn(local.zone);
      if (here.length > 0) return stepAct('tap', `step:seat:${here[0]}`);
      const best = def.seatMap.zones
        .map((z) => ({ id: z.id, n: freeIn(z.id).length }))
        .filter((z) => z.n > 0)
        .sort((a, b) => b.n - a.n)[0];
      return best ? stepAct('tap', `step:zone:${best.id}`) : [];
    }
    case 'quantity':
      if (local.kind !== 'quantity') return [];
      if (local.popup) return stepAct('tap', 'step:popup-ok');
      return local.qty < def.completesWhen.min
        ? stepAct('tap', 'step:qty-plus')
        : stepAct('tap', 'step:next');
    case 'payment': {
      if (local.kind !== 'payment') return [];
      const method = def.payment.methods[0];
      if (!local.method && method) return stepAct('tap', `step:method:${method.id}`);
      if (def.payment.requireAgree && !local.agreed) return stepAct('tap', 'step:agree');
      return stepAct('tap', 'step:pay');
    }
    case 'choose': {
      const ok = def.choose.options.find((o) => o.correct);
      return ok ? stepAct('tap', `step:opt:${ok.id}`) : [];
    }
    case 'hold':
      if (allowed('step:hold')) mem.hold = { target: 'step:hold', start: t };
      return [];
    case 'confirm':
      return stepAct('tap', 'step:confirm');
  }
}

function holdNeed(ctx: RunContext, s: RunState, target: string): number | null {
  if (target === 'step:hold') {
    const def = ctx.stage.steps[s.stepIndex];
    return def?.kind === 'hold' ? def.hold.ticks : null;
  }
  const [, idx] = target.split(':');
  const c = s.cards[Number(idx)];
  const def = c ? ctx.defs[c.idx] : undefined;
  if (!c || c.status !== 'active' || def?.resolve.kind !== 'hold') return null;
  return def.resolve.ticks;
}
