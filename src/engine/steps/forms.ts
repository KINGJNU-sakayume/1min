import type { ChooseLocal, Input, PaymentLocal, QuantityLocal } from '../types';
import { done, same, stepParts, type StepCtx, type StepOf, type StepUpdate } from './context';

/** 가격/할인: 기본가 수량이 0매로 시작하는 함정 (realism-spec §1.1) */
export const quantity = {
  init: (def: StepOf<'quantity'>): QuantityLocal => ({
    kind: 'quantity',
    qty: def.quantity.initial,
    popup: null,
  }),

  input(
    def: StepOf<'quantity'>,
    local: QuantityLocal,
    input: Input,
    ctx: StepCtx,
  ): StepUpdate<QuantityLocal> {
    if (input.action !== 'tap') return same(local);
    const [what] = stepParts(input);
    if (what === 'popup-ok') return same({ ...local, popup: null });
    if (local.popup) return same(local);
    if (what === 'qty-plus')
      return same({ ...local, qty: Math.min(def.quantity.max, local.qty + 1) });
    if (what === 'qty-minus') return same({ ...local, qty: Math.max(0, local.qty - 1) });
    if (what === 'next') {
      if (local.qty >= def.completesWhen.min) return done(local);
      ctx.stat('zeroQty');
      return same({ ...local, popup: 'zero' });
    }
    return same(local);
  },

  hook(def: StepOf<'quantity'>, local: QuantityLocal, name: string): QuantityLocal {
    return name === 'reset' ? { ...local, qty: def.quantity.initial } : local;
  },
};

/** 결제: 결제수단 + 약관 동의 → 결제하기 */
export const payment = {
  init: (): PaymentLocal => ({ kind: 'payment', method: null, agreed: false }),

  input(
    def: StepOf<'payment'>,
    local: PaymentLocal,
    input: Input,
    ctx: StepCtx,
  ): StepUpdate<PaymentLocal> {
    if (input.action !== 'tap') return same(local);
    const [what, arg] = stepParts(input);
    if (what === 'method' && def.payment.methods.some((m) => m.id === arg)) {
      return same({ ...local, method: arg ?? null });
    }
    if (what === 'agree') return same({ ...local, agreed: !local.agreed });
    if (what === 'pay') {
      if (local.method && (local.agreed || !def.payment.requireAgree)) return done(local);
      ctx.emit({ type: 'notice', key: 'pay.incomplete' });
    }
    return same(local);
  },
};

/** 선택지 고르기 (튜토리얼 파일 선택 등) */
export const choose = {
  init: (def: StepOf<'choose'>, ctx: StepCtx): ChooseLocal => ({
    kind: 'choose',
    order: ctx.layout.shuffle(def.choose.options.map((o) => o.id)),
  }),

  input(
    def: StepOf<'choose'>,
    local: ChooseLocal,
    input: Input,
    ctx: StepCtx,
  ): StepUpdate<ChooseLocal> {
    const [what, arg] = stepParts(input);
    if (input.action !== 'tap' || what !== 'opt') return same(local);
    const opt = def.choose.options.find((o) => o.id === arg);
    if (!opt) return same(local);
    if (opt.correct) return done(local);
    ctx.stat('wrongChoices');
    ctx.emit({ type: 'wrong', target: input.target });
    if (def.choose.wrongLockTicks > 0) ctx.lock(def.choose.wrongLockTicks);
    return same(local);
  },
};
