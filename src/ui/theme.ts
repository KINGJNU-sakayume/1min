import type { CSSProperties } from 'react';
import type { ThemeJson } from '../../content/schema/theme';

/** 스킨 토큰 → CSS 변수 (Tailwind 임의값 `bg-[var(--c-primary)]`로 쓴다) */
export function themeStyle(theme: ThemeJson): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(theme.colors)) vars[`--c-${k}`] = v;
  vars['--radius'] = `${theme.layout.radius}px`;
  vars['--pc-main'] = `${Math.round(theme.layout.pcMainRatio * 100)}%`;
  return vars as CSSProperties;
}
