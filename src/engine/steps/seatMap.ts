import type { Input, SeatLocal } from '../types';
import { done, same, stepParts, type StepCtx, type StepOf, type StepUpdate } from './context';

/** 좌석 선택 (realism-spec §1.3): 경쟁자가 시드로 정해진 틱에 좌석을 가져가고, 화면 반영은 늦다 */

type Zone = StepOf<'seatMap'>['seatMap']['zones'][number];

const ROWS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function zoneSeatIds(zone: Zone): string[] {
  const ids: string[] = [];
  for (let r = 0; r < zone.rows; r++) {
    for (let c = 1; c <= zone.cols; c++) ids.push(`${zone.id}-${ROWS[r]}${c}`);
  }
  return ids;
}

export function zoneOfSeat(seatId: string): string {
  return seatId.slice(0, seatId.indexOf('-'));
}

function takenBy(local: SeatLocal, seatId: string, at: number): boolean {
  const when = local.takenAt[seatId];
  if (when === undefined) return false;
  if (local.selected === seatId && when > local.selectedAt) return false;
  return when <= at;
}

/** 화면에 보이는 좌석 상태 (revealLag만큼 늦게 회색이 된다) */
export function seatView(
  local: SeatLocal,
  seatId: string,
  tick: number,
  lag: number,
): 'free' | 'taken' | 'mine' {
  if (local.selected === seatId) return 'mine';
  return takenBy(local, seatId, tick - lag) ? 'taken' : 'free';
}

export const seatMap = {
  init(def: StepOf<'seatMap'>, ctx: StepCtx): SeatLocal {
    const sm = def.seatMap;
    const takenAt: Record<string, number> = {};
    const free: string[] = [];
    for (const zone of sm.zones) {
      for (const id of zoneSeatIds(zone)) {
        if (ctx.layout.chance(zone.initialTakenRatio)) takenAt[id] = -1;
        else free.push(id);
      }
    }
    let t = ctx.tick;
    while (free.length > 0) {
      t += ctx.layout.range(sm.competitor.waveTicks);
      if (t >= ctx.runEndTick) break;
      const n = ctx.layout.range(sm.competitor.perWave);
      for (let i = 0; i < n && free.length > 0; i++) {
        const [id] = free.splice(ctx.layout.int(0, free.length - 1), 1);
        if (id !== undefined) takenAt[id] = t;
      }
    }
    const first = sm.zones[0];
    return {
      kind: 'seatMap',
      zone: first ? first.id : '',
      selected: null,
      selectedAt: 0,
      takenAt,
      popup: null,
      snipeArmed: false,
    };
  },

  input(
    def: StepOf<'seatMap'>,
    local: SeatLocal,
    input: Input,
    ctx: StepCtx,
  ): StepUpdate<SeatLocal> {
    if (input.action !== 'tap') return same(local);
    const [what, arg] = stepParts(input);
    if (what === 'seat-ok') return same({ ...local, popup: null });
    if (local.popup) return same(local);
    if (what === 'zone' && arg && def.seatMap.zones.some((z) => z.id === arg)) {
      return same({ ...local, zone: arg });
    }
    if (what === 'seat' && arg) {
      if (zoneOfSeat(arg) !== local.zone || !isSeat(def, arg)) return same(local);
      if (local.selected === arg) return same({ ...local, selected: null });
      if (takenBy(local, arg, ctx.tick)) {
        if (seatView(local, arg, ctx.tick, def.seatMap.revealLagTicks) === 'taken') {
          ctx.emit({ type: 'wrong', target: input.target });
          return same(local);
        }
        // 화면엔 빈자리였는데 이미 팔림 → "이미 선택된 좌석입니다"
        ctx.stat('seatConflicts');
        ctx.emit({ type: 'notice', key: 'seat.conflict' });
        return same({ ...local, popup: 'conflict' });
      }
      if (local.snipeArmed) {
        // 누르는 순간 다른 사람이 먼저 가져갔다
        ctx.stat('seatConflicts');
        ctx.emit({ type: 'notice', key: 'seat.conflict' });
        return same({
          ...local,
          takenAt: { ...local.takenAt, [arg]: ctx.tick },
          popup: 'conflict',
          snipeArmed: false,
        });
      }
      return same({ ...local, selected: arg, selectedAt: ctx.tick });
    }
    if (what === 'confirm') {
      if (local.selected) return done(local);
      ctx.emit({ type: 'notice', key: 'seat.none' });
    }
    return same(local);
  },

  hook(_def: StepOf<'seatMap'>, local: SeatLocal, name: string): SeatLocal {
    return name === 'snipeNext' ? { ...local, snipeArmed: true } : local;
  },
};

function isSeat(def: StepOf<'seatMap'>, seatId: string): boolean {
  const zone = def.seatMap.zones.find((z) => z.id === zoneOfSeat(seatId));
  return zone !== undefined && zoneSeatIds(zone).includes(seatId);
}
