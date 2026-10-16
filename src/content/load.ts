import { rawContent, type RawContent } from '../../content';
import { cardFileSchema, type CardJson } from '../../content/schema/card';
import { copySchema, type Copy } from '../../content/schema/copy';
import { directorSchema } from '../../content/schema/director';
import {
  fixedScheduleSchema,
  stageSchema,
  type FixedScheduleJson,
  type StageJson,
} from '../../content/schema/stage';
import { buildEngineContent } from '../engine/content';
import type { EngineContent } from '../engine/types';

export interface ParsedContent {
  copy: Copy;
  engine: EngineContent;
  cards: CardJson[];
  stageFiles: { file: string; stage: StageJson }[];
  fixedFiles: { file: string; fixed: FixedScheduleJson }[];
}

export class ContentError extends Error {
  constructor(readonly issues: string[]) {
    super(`콘텐츠 오류 ${issues.length}건:\n${issues.join('\n')}`);
  }
}

/** zod로 모든 JSON을 파싱한다. 실패하면 ContentError (사람이 읽을 경로 포함) */
export function parseContent(raw: RawContent = rawContent): ParsedContent {
  const issues: string[] = [];
  const parse = <T>(
    label: string,
    schema: {
      safeParse: (
        v: unknown,
      ) =>
        | { success: true; data: T }
        | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
    },
    value: unknown,
  ): T | null => {
    const r = schema.safeParse(value);
    if (r.success) return r.data;
    for (const i of r.error.issues)
      issues.push(`${label} ${i.path.map(String).join('.')}: ${i.message}`);
    return null;
  };

  const copy = parse('copy/ko.json', copySchema, raw.copy) ?? {};
  const director = parse('director.json', directorSchema, raw.director);
  const cards = raw.cardFiles.flatMap(
    (f) => parse(`cards/${f.file}`, cardFileSchema, f.data)?.cards ?? [],
  );
  const stageFiles = raw.stageFiles.flatMap((f) => {
    const stage = parse(`stages/${f.file}`, stageSchema, f.data);
    return stage ? [{ file: f.file, stage }] : [];
  });
  const fixedFiles = raw.fixedFiles.flatMap((f) => {
    const fixed = parse(`stages/fixed/${f.file}`, fixedScheduleSchema, f.data);
    return fixed ? [{ file: f.file, fixed }] : [];
  });
  if (issues.length > 0 || !director) throw new ContentError(issues);

  const engine = buildEngineContent({
    director,
    cards,
    stages: stageFiles.map((s) => s.stage),
    fixed: fixedFiles.map((f) => f.fixed),
  });
  return { copy, engine, cards, stageFiles, fixedFiles };
}

let cached: ParsedContent | null = null;

/** 앱·테스트에서 쓰는 검증된 콘텐츠 (한 번만 파싱) */
export function loadContent(): ParsedContent {
  cached ??= parseContent();
  return cached;
}
