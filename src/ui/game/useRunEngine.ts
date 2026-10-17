import { useCallback, useEffect, useRef, useState } from 'react';
import { createInitialState, step } from '../../engine/reducer';
import type { Action, EngineEvent, Input, RunContext, RunState } from '../../engine/types';

/**
 * 엔진과 실제 시간을 잇는 유일한 곳. requestAnimationFrame 누산기로 50ms마다 step을 부른다.
 * 입력은 큐에 모았다가 처리되는 틱 번호를 붙여 넘긴다 → 입력 로그만으로 판을 재현할 수 있다.
 */
const TICK_MS = 50;
/** 탭을 오래 비웠다 돌아와도 한 프레임에 따라잡는 시간 상한 */
const MAX_CATCHUP_MS = 250;

type Pending = Omit<Input, 'tick'>;

export interface RunEngine {
  state: RunState;
  /** 지금까지의 입력 로그 (리플레이·복수전용) */
  getInputs: () => readonly Input[];
  send: (action: Action, target: string, value?: string) => void;
  start: () => void;
}

export function useRunEngine(
  ctx: RunContext,
  onEvents: (events: EngineEvent[], state: RunState) => void,
): RunEngine {
  const [state, setState] = useState<RunState>(() => createInitialState(ctx));
  const stateRef = useRef(state);
  const queue = useRef<Pending[]>([]);
  const log = useRef<Input[]>([]);
  const onEventsRef = useRef(onEvents);
  useEffect(() => {
    onEventsRef.current = onEvents;
  }, [onEvents]);

  const apply = useCallback(
    (inputs: Input[]) => {
      const out = step(ctx, stateRef.current, inputs);
      log.current.push(...inputs);
      stateRef.current = out.state;
      if (out.events.length > 0) onEventsRef.current(out.events, out.state);
    },
    [ctx],
  );

  const start = useCallback(() => {
    if (stateRef.current.phase !== 'READY') return;
    apply([{ tick: 0, action: 'start', target: 'run' }]);
    setState(stateRef.current);
  }, [apply]);

  const send = useCallback((action: Action, target: string, value?: string) => {
    queue.current.push(value === undefined ? { action, target } : { action, target, value });
  }, []);

  useEffect(() => {
    let raf = 0;
    let last: number | null = null;
    let acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = stateRef.current;
      if (s.phase === 'READY' || s.phase === 'RESULT') {
        last = now;
        return;
      }
      acc += Math.min(MAX_CATCHUP_MS, last === null ? 0 : now - last);
      last = now;
      let changed = false;
      while (acc >= TICK_MS && stateRef.current.phase !== 'RESULT') {
        const tick = stateRef.current.tick;
        const inputs = queue.current.splice(0).map((p) => ({ ...p, tick }));
        apply(inputs);
        acc -= TICK_MS;
        changed = true;
      }
      if (changed) setState(stateRef.current);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [apply]);

  const getInputs = useCallback(() => [...log.current], []);
  return { state, getInputs, send, start };
}
