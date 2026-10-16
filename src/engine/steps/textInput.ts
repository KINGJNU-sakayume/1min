import type { Input, TextInputLocal } from '../types';
import { done, same, type StepCtx, type StepOf, type StepUpdate } from './context';

/** 문자 입력 (안심예매 문자, 생년월일 6자리). 코드는 layout 스트림 */
export const textInput = {
  init(def: StepOf<'textInput'>, ctx: StepCtx): TextInputLocal {
    return { kind: 'textInput', code: makeCode(def, ctx), wrong: 0, clearSeq: 0 };
  },

  input(
    def: StepOf<'textInput'>,
    local: TextInputLocal,
    input: Input,
    ctx: StepCtx,
  ): StepUpdate<TextInputLocal> {
    if (input.action !== 'type' || input.target !== 'step:submit') return same(local);
    if ((input.value ?? '').trim().toUpperCase() === local.code) return done(local);
    ctx.stat(def.input.regenerateOnWrong ? 'captchaWrong' : 'inputWrong');
    ctx.emit({ type: 'wrong', target: input.target });
    return same({
      ...local,
      wrong: local.wrong + 1,
      code: def.input.regenerateOnWrong ? makeCode(def, ctx) : local.code,
      clearSeq: local.clearSeq + 1,
    });
  },

  hook(
    _def: StepOf<'textInput'>,
    local: TextInputLocal,
    name: string,
    ctx: StepCtx,
  ): TextInputLocal {
    if (name !== 'clear') return local;
    ctx.emit({ type: 'notice', key: 'textInput.cleared' });
    return { ...local, clearSeq: local.clearSeq + 1 };
  },
};

function makeCode(def: StepOf<'textInput'>, ctx: StepCtx): string {
  return ctx.layout.code(ctx.layout.range(def.input.length), def.input.alphabet);
}
