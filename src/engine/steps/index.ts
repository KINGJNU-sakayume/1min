import type { Input, StepJson, StepLocal } from '../types';
import { same, type StepCtx, type StepUpdate } from './context';
import { choose, payment, quantity } from './forms';
import { queue } from './queue';
import { seatMap } from './seatMap';
import { confirm, hold, openButton } from './simple';
import { textInput } from './textInput';

/**
 * 단계 종류(kind) → 핸들러. 새 kind는 여기에 case를 더한다 (엔진 코어 변경 지점, 결정 0002 참고).
 * local.kind가 def.kind와 다르면(되돌림 직후 등) 아무것도 하지 않는다.
 */

export function stepInit(def: StepJson, ctx: StepCtx): StepLocal {
  switch (def.kind) {
    case 'openButton':
      return openButton.init();
    case 'queue':
      return queue.init(def, ctx);
    case 'textInput':
      return textInput.init(def, ctx);
    case 'seatMap':
      return seatMap.init(def, ctx);
    case 'quantity':
      return quantity.init(def);
    case 'payment':
      return payment.init();
    case 'choose':
      return choose.init(def, ctx);
    case 'hold':
      return hold.init();
    case 'confirm':
      return confirm.init();
  }
}

export function stepInput(
  def: StepJson,
  local: StepLocal,
  input: Input,
  ctx: StepCtx,
): StepUpdate<StepLocal> {
  switch (def.kind) {
    case 'openButton':
      return local.kind === 'openButton' ? openButton.input(def, local, input, ctx) : same(local);
    case 'queue':
      return local.kind === 'queue' ? queue.input(def, local, input, ctx) : same(local);
    case 'textInput':
      return local.kind === 'textInput' ? textInput.input(def, local, input, ctx) : same(local);
    case 'seatMap':
      return local.kind === 'seatMap' ? seatMap.input(def, local, input, ctx) : same(local);
    case 'quantity':
      return local.kind === 'quantity' ? quantity.input(def, local, input, ctx) : same(local);
    case 'payment':
      return local.kind === 'payment' ? payment.input(def, local, input, ctx) : same(local);
    case 'choose':
      return local.kind === 'choose' ? choose.input(def, local, input, ctx) : same(local);
    case 'hold':
      return hold.input(def, { kind: 'hold' }, input);
    case 'confirm':
      return confirm.input(def, { kind: 'confirm' }, input);
  }
}

export function stepTick(def: StepJson, local: StepLocal, ctx: StepCtx): StepUpdate<StepLocal> {
  if (def.kind === 'queue' && local.kind === 'queue') return queue.tick(def, local, ctx);
  return same(local);
}

/** 카드 활성 순간의 신호 (`seatMap.release` 등). 현재 단계 kind와 접두가 같을 때만 */
export function stepHook(def: StepJson, local: StepLocal, hook: string, ctx: StepCtx): StepLocal {
  const [kind, name] = hook.split('.');
  if (kind !== def.kind || !name) return local;
  if (def.kind === 'seatMap' && local.kind === 'seatMap')
    return seatMap.hook(def, local, name, ctx);
  if (def.kind === 'quantity' && local.kind === 'quantity') return quantity.hook(def, local, name);
  if (def.kind === 'textInput' && local.kind === 'textInput')
    return textInput.hook(def, local, name, ctx);
  return local;
}

/** queueBack 실패 효과 */
export function stepQueueBack(def: StepJson, local: StepLocal, amount: number): StepLocal | null {
  return def.kind === 'queue' && local.kind === 'queue' ? queue.back(def, local, amount) : null;
}
