import type { CourseCartLocal, CourseState, Input } from '../types';
import { done, same, stepParts, type StepCtx, type StepOf, type StepUpdate } from './context';

/**
 * 수강신청 장바구니 (realism-spec §2.2): 과목마다 idle → pending(서버 지연) → success | full | blocked,
 * 정각 전·지연 카드 중에는 notPeriod 팝업. 마감 틱은 장바구니 인원/정원으로 정해지고 화면에는 숨는다.
 */
type Def = StepOf<'courseCart'>;

export function registered(local: CourseCartLocal): number {
  return Object.values(local.courses).filter((c) => c.status === 'success').length;
}

/** 같은 시간표 칸에 이미 신청했거나 처리 중인 과목이 있는가 */
export function overlaps(def: Def, local: CourseCartLocal, courseId: string): boolean {
  const slot = def.courseCart.courses.find((c) => c.id === courseId)?.slot;
  return def.courseCart.courses.some(
    (c) =>
      c.id !== courseId &&
      c.slot === slot &&
      ['success', 'pending'].includes(local.courses[c.id]?.status ?? ''),
  );
}

export const courseCart = {
  init(def: Def, ctx: StepCtx): CourseCartLocal {
    const cc = def.courseCart;
    const courses: Record<string, CourseState> = {};
    const cart: Record<string, number> = {};
    const fullAt: Record<string, number | null> = {};
    for (const c of cc.courses) {
      const n = ctx.layout.range(c.cartCount);
      const wobble = 1 + cc.fillJitter * (2 * ctx.layout.next() - 1);
      courses[c.id] = { status: 'idle', resolveAt: 0, forceFull: false };
      cart[c.id] = n;
      fullAt[c.id] =
        n <= c.capacity
          ? null
          : ctx.t0 + Math.round(((cc.fillBaseTicks * c.capacity) / n) * wobble);
    }
    return {
      kind: 'courseCart',
      courses,
      cart,
      fullAt,
      popup: null,
      notPeriodUntil: 0,
      slowUntil: 0,
      lateFullArmed: false,
      blockArmed: false,
    };
  },

  input(def: Def, local: CourseCartLocal, input: Input, ctx: StepCtx): StepUpdate<CourseCartLocal> {
    if (input.action !== 'tap') return same(local);
    const [what, id] = stepParts(input);
    if (what === 'popup-ok') return same({ ...local, popup: null });
    if (local.popup) return same(local);
    if (what === 'done') {
      if (registered(local) >= def.completesWhen.count) return done(local);
      ctx.emit({ type: 'notice', key: 'course.needMore' });
      return same(local);
    }
    if (what !== 'apply' || !id) return same(local);
    const course = def.courseCart.courses.find((c) => c.id === id);
    const st = local.courses[id];
    if (!course || !st || st.status === 'pending' || st.status === 'success') return same(local);
    const popup = (kind: NonNullable<CourseCartLocal['popup']>['kind'], stat: string) => {
      ctx.stat(stat);
      return same({ ...local, popup: { kind, course: id } });
    };
    if (st.status === 'full') return popup('full', 'coursesFull');
    if (st.status === 'blocked') return popup('blocked', 'coursesBlocked');
    if (ctx.tick < ctx.t0 || ctx.tick < local.notPeriodUntil)
      return popup('notPeriod', 'notPeriodHits');
    if (overlaps(def, local, id)) return popup('overlap', 'timetableOverlap');
    const setCourse = (next: CourseState, extra: Partial<CourseCartLocal> = {}) => ({
      ...local,
      ...extra,
      courses: { ...local.courses, [id]: next },
    });
    if (local.blockArmed) {
      ctx.stat('coursesBlocked');
      return same(
        setCourse(
          { ...st, status: 'blocked' },
          { blockArmed: false, popup: { kind: 'blocked', course: id } },
        ),
      );
    }
    const cc = def.courseCart;
    const delay =
      ctx.layout.range(cc.pendingTicks) +
      (ctx.tick < local.slowUntil ? cc.slowExtraTicks : 0) +
      (local.lateFullArmed ? cc.lateFullExtraTicks : 0);
    ctx.emit({ type: 'notice', key: 'course.pending' });
    return same(
      setCourse(
        { status: 'pending', resolveAt: ctx.tick + delay, forceFull: local.lateFullArmed },
        { lateFullArmed: false },
      ),
    );
  },

  tick(def: Def, local: CourseCartLocal, ctx: StepCtx): StepUpdate<CourseCartLocal> {
    let next = local;
    for (const c of def.courseCart.courses) {
      const st = next.courses[c.id];
      if (!st || st.status !== 'pending' || ctx.tick < st.resolveAt) continue;
      const fullAt = next.fullAt[c.id] ?? null;
      const full = st.forceFull || (fullAt !== null && ctx.tick >= fullAt);
      if (full) ctx.stat('coursesFull');
      else {
        ctx.stat('coursesRegistered');
        ctx.stat('creditsRegistered', c.credits);
      }
      next = {
        ...next,
        courses: { ...next.courses, [c.id]: { ...st, status: full ? 'full' : 'success' } },
        popup: full && !next.popup ? { kind: 'full', course: c.id } : next.popup,
      };
    }
    return same(next);
  },

  hook(def: Def, local: CourseCartLocal, name: string, ctx: StepCtx): CourseCartLocal {
    const cc = def.courseCart;
    if (name === 'notPeriod') return { ...local, notPeriodUntil: ctx.tick + cc.notPeriodCardTicks };
    if (name === 'slow') return { ...local, slowUntil: ctx.tick + cc.slowExtraTicks };
    if (name === 'lateFull') return { ...local, lateFullArmed: true };
    if (name === 'blockNext') return { ...local, blockArmed: true };
    return local;
  },
};
