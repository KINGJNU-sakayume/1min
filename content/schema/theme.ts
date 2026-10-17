import { z } from 'zod';
import { slugSchema } from './common';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/**
 * 스킨 토큰 (realism-spec §6): 색과 레이아웃 비율. 실제 화면을 보고 보정할 값은 여기만 고친다.
 * 브랜드 고유 색 조합을 베끼지 않는다 (brand-and-tone §3.2).
 */
export const themeSchema = z.object({
  id: slugSchema,
  colors: z.object({
    primary: hex,
    primaryInk: hex,
    surface: hex,
    paper: hex,
    ink: hex,
    muted: hex,
    line: hex,
    seatFree: hex,
    seatTaken: hex,
    seatMine: hex,
    danger: hex,
  }),
  layout: z.object({
    /** PC: 좌석도(왼쪽) : 정보 패널(오른쪽) 비율 */
    pcMainRatio: z.number().min(0.4).max(0.85),
    /** 좌석 모양 (젤리빈 = 둥근 타원) */
    seatShape: z.enum(['jellybean', 'square', 'circle']),
    /** 모서리 반경 px */
    radius: z.number().int().min(0).max(24),
    /** 팝업 모양 */
    popupStyle: z.enum(['center', 'sheet']),
    /** 대기 화면에서 안내문을 숫자 위/아래 어디에 */
    queueNoticePosition: z.enum(['above', 'below']),
  }),
  evidence: z.string(),
});

export type ThemeJson = z.infer<typeof themeSchema>;
