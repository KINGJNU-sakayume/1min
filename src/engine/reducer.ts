import { conflicts, windowMatches } from './content';
import { nominalSpan } from './director';
import { Rng, streamSeed } from './rng';
import type { StepCtx } from './steps/context';
import { stepHook, stepInit, stepInput, stepQueueBack, stepTick } from './steps';
import type {
  CardDef,
  CardRuntime,
  EngineEvent,
  Input,
  Judgment,
  RunContext,
  RunState,
  ScheduleEntry,
  StepJson,
} from './types';
import type { FailEffect } from '../../content/schema/common';

/**
 * 순수 리듀서 (game-rules §3, hazard-system §7).
 * `step(ctx, state, inputs)`는 한 틱을 진행한다: 시간 진행(카드·단계·제한시간) → 이 틱의 입력 → tick+1.
 * READY에서는 `start` 입력만 받고 틱이 흐르지 않는다.
 */

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type DraftState = Mutable<Omit<RunState, 'cards' | 'stats' | 'synergies'>> & {
  cards: Mutable<CardRuntime>[];
  stats: Record<string, number>;
  synergies: string[];
};

export interface StepOutput {
  state: RunState;
  events: EngineEvent[];
}

export function createInitialState(ctx: RunContext): RunState {
  const seed = ctx.schedule.seedString;
  return {
    phase: 'READY',
    tick: 0,
    runStartTick: ctx.t0,
    penaltyTicks: 0,
    lockUntil: 0,
    early: false,
    judgment: null,
    openTick: null,
    stepIndex: 0,
    stepEnteredAt: 0,
    stepDeadline: null,
    step: { kind: 'confirm' },
    cards: ctx.schedule.entries.map((e) => ({
      idx: e.idx,
      status: 'scheduled',
      pendingSince: null,
      telegraphAt: null,
      activeAt: null,
      endAt: null,
      finishedAt: null,
      late: false,
      taps: [],
    })),
    rng: {
      layout: streamSeed(seed, 'layout'),
      queue: streamSeed(seed, 'queue'),
      cosmetic: streamSeed(seed, 'cosmetic'),
    },
    combo: 0,
    stats: {},
    synergies: [],
    finishedAt: null,
    outcome: null,
    reason: null,
  };
}

export function step(ctx: RunContext, state: RunState, inputs: readonly Input[]): StepOutput {
  if (state.phase === 'RESULT') return { state, events: [] };
  const d = new Draft(ctx, state);
  if (state.phase === 'READY') {
    if (inputs.some((i) => i.action === 'start')) d.start();
    return d.output();
  }
  d.advanceTime();
  for (const input of inputs) {
    if (d.s.phase === 'RESULT') break;
    if (input.tick === d.s.tick && input.action !== 'start') d.input(input);
  }
  if (d.s.phase !== 'RESULT') d.s.tick += 1;
  return d.output();
}

/** 남은 틱 (패널티 반영) */
export function remainingTicks(ctx: RunContext, s: RunState, at = s.finishedAt ?? s.tick): number {
  return s.runStartTick + ctx.durationTicks - s.penaltyTicks - at;
}

export function matchesTarget(target: string, pattern: string): boolean {
  return target === pattern || target.startsWith(`${pattern}:`);
}

export function isStepPattern(pattern: string): boolean {
  return pattern === 'step' || pattern.startsWith('step:');
}

class Draft {
  readonly s: DraftState;
  readonly events: EngineEvent[] = [];
  private readonly steps: readonly StepJson[];

  constructor(
    private readonly ctx: RunContext,
    state: RunState,
  ) {
    this.s = {
      ...state,
      cards: state.cards.map((c) => ({ ...c })),
      stats: { ...state.stats },
      synergies: [...state.synergies],
      rng: { ...state.rng },
    };
    this.steps = ctx.stage.steps;
  }

  output(): StepOutput {
    return { state: this.s, events: this.events };
  }

  // ── 공통 도구 ──────────────────────────────────────────────

  private emit(e: EngineEvent) {
    this.events.push(e);
  }

  private stat(name: string, delta = 1) {
    this.s.stats[name] = (this.s.stats[name] ?? 0) + delta;
  }

  private lock(ticks: number) {
    this.s.lockUntil = Math.max(this.s.lockUntil, this.s.tick + ticks);
  }

  private get stepDef(): StepJson {
    const def = this.steps[this.s.stepIndex];
    if (!def) throw new Error(`단계 없음: ${this.s.stepIndex}`);
    return def;
  }

  private def(c: CardRuntime): CardDef {
    const def = this.ctx.defs[c.idx];
    if (!def) throw new Error(`카드 정의 없음: ${c.idx}`);
    return def;
  }

  private entry(c: CardRuntime): ScheduleEntry {
    const e = this.ctx.schedule.entries[c.idx];
    if (!e) throw new Error(`스케줄 없음: ${c.idx}`);
    return e;
  }

  private stepCtx(): StepCtx {
    const s = this.s;
    return {
      tick: s.tick,
      level: this.ctx.level,
      t0: this.ctx.t0,
      runEndTick: s.runStartTick + this.ctx.durationTicks,
      judgment: s.judgment,
      early: s.early,
      director: this.ctx.content.director,
      layout: new Rng(
        () => s.rng.layout,
        (n) => {
          s.rng.layout = n;
        },
      ),
      queue: new Rng(
        () => s.rng.queue,
        (n) => {
          s.rng.queue = n;
        },
      ),
      stat: (name, delta) => this.stat(name, delta),
      emit: (e) => this.emit(e),
      lock: (ticks) => this.lock(ticks),
      judge: (judgment: Judgment, delta: number) => {
        s.judgment = judgment;
        s.openTick = s.tick;
        this.emit({ type: 'judgment', judgment, delta });
      },
      markEarly: () => {
        s.early = true;
      },
    };
  }

  // ── 상태 머신 ──────────────────────────────────────────────

  start() {
    const open = this.ctx.stage.mode === 'open';
    this.s.phase = open ? 'PREROLL' : 'RUNNING';
    this.s.runStartTick = this.ctx.t0;
    this.emit({ type: 'phase', phase: this.s.phase });
    this.enterStep(0);
  }

  private finish(outcome: 'success' | 'fail', reason: string) {
    if (this.s.phase === 'RESULT') return;
    this.s.phase = 'RESULT';
    this.s.outcome = outcome;
    this.s.reason = reason;
    this.s.finishedAt = this.s.tick;
    this.emit({ type: 'finish', outcome, reason });
    this.emit({ type: 'phase', phase: 'RESULT' });
  }

  private enterStep(index: number) {
    const def = this.steps[index];
    if (!def) return;
    this.s.stepIndex = index;
    this.s.stepEnteredAt = this.s.tick;
    this.s.step = stepInit(def, this.stepCtx());
    this.s.stepDeadline = def.timeLimitTicks ? this.s.tick + def.timeLimitTicks : null;
    this.emit({ type: 'stepEnter', stepId: def.id });
    if (def.skippableAtLevel !== undefined && this.ctx.level <= def.skippableAtLevel) {
      this.emit({ type: 'stepSkipped', stepId: def.id });
      this.completeStep();
    }
  }

  private completeStep() {
    this.emit({ type: 'stepComplete', stepId: this.stepDef.id });
    if (this.s.stepIndex + 1 >= this.steps.length) this.finish('success', 'done');
    else this.enterStep(this.s.stepIndex + 1);
  }

  advanceTime() {
    const s = this.s;
    if (s.phase === 'PREROLL' && s.tick >= this.ctx.t0) {
      s.phase = 'RUNNING';
      this.emit({ type: 'phase', phase: 'RUNNING' });
    }
    if (s.phase !== 'RUNNING') return;

    const upd = stepTick(this.stepDef, s.step, this.stepCtx());
    s.step = upd.local;
    if (upd.done) this.completeStep();
    if (s.phase !== 'RUNNING') return;

    this.processCards();
    if (s.phase !== 'RUNNING') return;

    if (s.stepDeadline !== null && s.tick >= s.stepDeadline) {
      const def = this.stepDef;
      s.stepDeadline = null;
      this.stat('stepTimeouts');
      this.emit({ type: 'stepTimeout', stepId: def.id });
      this.applyFail(def.onTimeout ?? { kind: 'fatal', reason: 'stepTimeout' });
    }
    if (s.phase === 'RUNNING' && remainingTicks(this.ctx, s) <= 0) this.finish('fail', 'timeout');
  }

  // ── 카드 ──────────────────────────────────────────────────

  private processCards() {
    const s = this.s;
    const step = this.stepDef;
    const dir = this.ctx.content.director;
    for (const c of s.cards) {
      if (s.phase !== 'RUNNING') return;
      const def = this.def(c);
      const anchor = this.entry(c).anchor;
      const anchorIndex =
        anchor.kind === 'step' ? this.steps.findIndex((x) => x.id === anchor.stepId) : -1;

      if (c.status === 'scheduled') {
        const due =
          anchor.kind === 'run'
            ? s.tick >= s.runStartTick + anchor.tick
            : s.stepIndex === anchorIndex && s.tick >= s.stepEnteredAt + anchor.offset;
        if (anchor.kind === 'step' && s.stepIndex > anchorIndex) {
          this.setStatus(c, 'skipped');
        } else if (due) {
          c.pendingSince = s.tick;
          this.setStatus(c, 'pending');
        }
      }

      if (c.status === 'pending') {
        const passed = anchor.kind === 'step' && s.stepIndex > anchorIndex;
        if (passed || s.tick - (c.pendingSince ?? s.tick) > dir.pendingMaxTicks) {
          this.setStatus(c, 'skipped');
        } else if (windowMatches(def, step) && this.hasCapacity(def)) {
          c.telegraphAt = s.tick;
          c.activeAt = s.tick + def.telegraphTicks;
          this.setStatus(c, 'telegraph');
        }
      }

      if (c.status === 'telegraph' && c.activeAt !== null && s.tick >= c.activeAt)
        this.activate(c, def);

      if (c.status === 'active') {
        if (c.endAt !== null && s.tick >= c.endAt) {
          if (def.expire === 'resolve') this.resolveCard(c, def, true);
          else this.failCard(c, def);
        } else if (c.endAt === null && !windowMatches(def, this.stepDef)) {
          // 해결형 카드인데 단계가 바뀌어 대상이 사라짐 (되돌림 등)
          this.setStatus(c, 'skipped');
          c.finishedAt = s.tick;
        }
      }
    }
  }

  private hasCapacity(def: CardDef): boolean {
    const live = this.s.cards.filter((x) => x.status === 'telegraph' || x.status === 'active');
    return live.length < this.ctx.maxSlots && !live.some((x) => conflicts(def, this.def(x)));
  }

  private setStatus(c: Mutable<CardRuntime>, status: CardRuntime['status']) {
    c.status = status;
    this.emit({ type: 'card', idx: c.idx, status });
  }

  private activate(c: Mutable<CardRuntime>, def: CardDef) {
    const s = this.s;
    c.endAt = def.activeTicks === null ? null : s.tick + def.activeTicks;
    this.setStatus(c, 'active');
    if (def.effect.hook) s.step = stepHook(this.stepDef, s.step, def.effect.hook, this.stepCtx());
    if (def.effect.squeezeTimerTicks && s.stepDeadline !== null) {
      const floor = s.tick + this.ctx.content.director.squeezeMinRemainTicks;
      s.stepDeadline = Math.min(
        s.stepDeadline,
        Math.max(floor, s.stepDeadline - def.effect.squeezeTimerTicks),
      );
    }
    for (const other of s.cards) {
      if (other === c || other.status !== 'active') continue;
      const odef = this.def(other);
      for (const syn of def.synergyWith ?? [])
        if (odef.tags.includes(syn.tag)) this.addSynergy(syn.name);
      for (const syn of odef.synergyWith ?? [])
        if (def.tags.includes(syn.tag)) this.addSynergy(syn.name);
    }
  }

  private addSynergy(name: string) {
    if (this.s.synergies.includes(name)) return;
    this.s.synergies.push(name);
    this.emit({ type: 'synergy', name });
  }

  private resolveCard(c: Mutable<CardRuntime>, def: CardDef, expired: boolean) {
    const s = this.s;
    c.finishedAt = s.tick;
    const span = def.activeTicks ?? nominalSpan(def, this.ctx.content) - def.telegraphTicks;
    c.late =
      !expired &&
      c.activeAt !== null &&
      s.tick - c.activeAt > this.ctx.content.director.lateResolveFraction * span;
    this.setStatus(c, 'resolved');
    this.stat('resolved');
    if (c.late) this.stat('resolvedLate');
    s.combo += 1;
    s.stats.maxCombo = Math.max(s.stats.maxCombo ?? 0, s.combo);
  }

  private failCard(c: Mutable<CardRuntime>, def: CardDef) {
    c.finishedAt = this.s.tick;
    this.setStatus(c, 'failed');
    this.stat('failed');
    this.s.combo = 0;
    this.applyFail(def.failEffect);
  }

  private applyFail(effect: FailEffect) {
    const s = this.s;
    switch (effect.kind) {
      case 'none':
        return;
      case 'lock':
        this.lock(effect.ticks);
        return;
      case 'penalty':
        s.penaltyTicks += effect.ticks;
        return;
      case 'resetStep': {
        const to = effect.to
          ? this.steps.findIndex((x) => x.id === effect.to)
          : Math.max(0, s.stepIndex - 1);
        if (to < 0 || to > s.stepIndex) return;
        this.stat('stepResets');
        const target = this.steps[to];
        if (target) this.emit({ type: 'stepReset', to: target.id });
        this.enterStep(to);
        return;
      }
      case 'queueBack': {
        const next = stepQueueBack(this.stepDef, s.step, effect.amount);
        if (next) {
          s.step = next;
          this.stat('queueResets');
        }
        return;
      }
      case 'fatal':
        this.finish('fail', effect.reason ?? 'fatal');
        return;
    }
  }

  // ── 입력 ──────────────────────────────────────────────────

  input(input: Input) {
    const s = this.s;
    if (s.tick < s.lockUntil) {
      this.stat('lockedInputs');
      this.emit({ type: 'locked' });
      return;
    }
    if (s.phase === 'PREROLL') {
      // 정각 전에는 "예매하기"만 의미가 있다
      if (this.stepDef.kind === 'openButton') this.stepInputRaw(input);
      return;
    }
    if (input.target.startsWith('card:')) {
      this.cardInput(input);
      return;
    }
    if (!isStepPattern(input.target)) return;

    for (const c of s.cards) {
      if (c.status !== 'active') continue;
      const def = this.def(c);
      if (def.resolve.kind === 'avoid' && isStepPattern(def.resolve.target)) {
        if (matchesTarget(input.target, def.resolve.target)) {
          this.failCard(c, def);
          return;
        }
      }
      const rl = def.effect.rateLimit;
      if (rl && matchesTarget(input.target, rl.target)) {
        c.taps = [...c.taps.filter((x) => s.tick - x < rl.windowTicks), s.tick];
        if (c.taps.length > rl.maxTaps) {
          this.stat('rateLimited');
          this.failCard(c, def);
          return;
        }
      }
    }
    const blocker = s.cards.find((c) => c.status === 'active' && this.def(c).effect.blocksStep);
    if (blocker) {
      this.stat('blockedInputs');
      this.emit({ type: 'blocked', by: blocker.idx });
      return;
    }
    this.stepInputRaw(input);
  }

  private stepInputRaw(input: Input) {
    const upd = stepInput(this.stepDef, this.s.step, input, this.stepCtx());
    this.s.step = upd.local;
    if (upd.done) this.completeStep();
  }

  private cardInput(input: Input) {
    const [, idxText, ...rest] = input.target.split(':');
    const c = this.s.cards[Number(idxText)];
    if (!c || c.status !== 'active') return;
    const def = this.def(c);
    const part = rest.join(':');
    const r = def.resolve;
    switch (r.kind) {
      case 'tap':
        if (input.action === 'tap' && part === r.target) this.resolveCard(c, def, false);
        return;
      case 'hold': {
        const held = Number(input.value ?? '0');
        const pressedAt = this.s.tick - held;
        if (
          input.action === 'hold' &&
          part === r.target &&
          held >= r.ticks &&
          pressedAt >= (c.activeAt ?? 0)
        ) {
          this.resolveCard(c, def, false);
        }
        return;
      }
      case 'type':
        if (input.action !== 'type' || part !== 'submit') return;
        if ((input.value ?? '').trim().toUpperCase() === this.entry(c).code)
          this.resolveCard(c, def, false);
        else {
          this.stat('cardWrong');
          this.emit({ type: 'wrong', target: input.target });
        }
        return;
      case 'choose': {
        if (input.action !== 'tap' || !part.startsWith('opt:')) return;
        const opt = r.options.find((o) => o.id === part.slice(4));
        if (!opt) return;
        if (opt.correct) this.resolveCard(c, def, false);
        else {
          this.stat('wrongChoices');
          this.failCard(c, def);
        }
        return;
      }
      case 'avoid':
        if (!isStepPattern(r.target) && part === r.target) this.failCard(c, def);
        return;
      case 'ignore':
        if (part === r.target) {
          this.stat('ignoredTouched');
          this.failCard(c, def);
        }
        return;
      case 'none':
        return;
    }
  }
}
