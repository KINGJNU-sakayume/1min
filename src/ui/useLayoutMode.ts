import { useSyncExternalStore } from 'react';

/** PC(창/패널) vs 모바일(전체 화면 단계). 엔진은 같고 배치만 다르다 (결정 0001 #3) */
const QUERY = '(min-width: 768px)';

export type LayoutMode = 'pc' | 'mobile';

export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => (window.matchMedia(QUERY).matches ? 'pc' : 'mobile'),
    () => 'mobile',
  );
}
