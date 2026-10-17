# 아키텍처 (구현 정본)

상태: v0.1 (M1, 2026-10-16). 코드 구조와 데이터 흐름을 기록한다. 규칙의 정본은 `game-rules.md`, `stage-format.md`, `design/hazard-system.md`이고 이 문서는 **그 규칙을 어디에 구현했는가**를 적는다.

## 1. 층 구조

```
content/                JSON 데이터 + zod 스키마 (정본 타입)
  schema/*.ts           stage · card · director · copy · common
  stages/*.stage.json   스테이지, stages/fixed/*.json 고정 스케줄
  cards/*.cards.json    공통·스테이지 고유 카드
  copy/ko.json          모든 문구 (브랜드 이름은 brand.* 에만)
  director.json         전역 엔진·디렉터·봇 파라미터 (현실성·밸런스 수치)
  index.ts              JSON 원본 목록 (새 파일은 여기에 한 줄)
src/content/            파싱(load.ts) · 교차 검증(validate.ts) · 금지어(forbidden.ts) · 문구(copy.ts)
src/engine/             결정론 엔진 — DOM·React·실제 시계·Math.random 금지 (ESLint 강제)
src/ui/                 React 화면: game/(루프·단계·카드·HUD), screens/(홈·결과), storage·share·progression·feedback
scripts/                check-content(빌드 게이트), balance-report(개발용)
```

의존 방향: `ui → content(load) → engine → content/schema(타입만)`. 엔진은 JSON을 직접 import하지 않고 파싱된 `EngineContent`를 인자로 받는다.

## 2. 엔진 모듈

| 파일 | 역할 | 문서 근거 |
|---|---|---|
| `hash.ts` | FNV-1a 32, 정렬 JSON, 해시 | hazard §6 |
| `rng.ts` | mulberry32, 스트림 5개(`director/layout/queue/copy/cosmetic`) | hazard §6 |
| `seed.ts` | 시드 문자열 `{stage}|{level}|{code}`, 파생 시드 `#r{n}` | game-rules §11 |
| `content.ts` | 카드 ms→틱 변환, 상호배제·window 판정, contentVersion | hazard §3 |
| `director.ts` | 스케줄 생성 (예산·램프·슬롯·쿨다운·상호배제·고유 카드 보장) | hazard §5 |
| `reducer.ts` | `step(ctx, state, inputs)` 순수 리듀서, 상태 머신·카드 수명·실패 효과 | game-rules §3·§6 |
| `steps/*.ts` | 단계 종류(kind)별 핸들러 + `steps/index.ts` 디스패처 | stage-format §4 |
| `result.ts` | 결과 객체·칭호 규칙·별점·타임라인 | game-rules §8 |
| `replay.ts` | 입력 로그 재생, 결과 해시 | game-rules §7 |
| `bot/solver.ts` | 솔버 봇 (공정성 검증, 튜토리얼 안내 봇, 밸런스 봇) | hazard §5.6 |
| `run.ts` | 컨텍스트 생성, 솔버 검증 + 파생 시드 재시도 | hazard §5.6 |

## 3. 한 틱의 순서

`step(ctx, state, inputs)`:

1. READY면 `start` 입력만 처리하고 틱을 올리지 않는다.
2. PREROLL이고 `tick ≥ T0`이면 RUNNING.
3. RUNNING이면 시간 진행: 단계 tick(대기열 감소) → 카드 진행(scheduled→pending→telegraph→active→resolved/failed/skipped) → 단계 제한시간 → 판 제한시간.
4. 이 틱의 입력을 순서대로 처리: 잠금 → (`card:` 입력은 카드로) → 활성 카드의 감시(avoid·rateLimit) → blocksStep 차단 → 단계 핸들러.
5. `tick += 1`.

엔진 상태는 직렬화 가능한 순수 데이터다(PRNG 상태도 uint32 정수). UI는 `requestAnimationFrame` 누산기로 50ms마다 `step`을 부르고, 반환된 이벤트로 소리·진동·애니메이션을 낸다.

## 4. 카드 기준점 (결정 0002 #18)

- `window`가 없는 카드: 판 시작(T0) 기준 틱. 디렉터가 램프 가중치로 구간을 고른다.
- `window`가 있는 카드: **해당 단계 진입 후 offset 틱**. 단계를 지나치면 `skipped`.
- 런타임도 슬롯·상호배제를 다시 지킨다(대기 중 카드는 `pendingMaxTicks` 뒤 건너뜀). 테스트가 봇 판 300개에서 이를 확인한다.

## 5. 입력 대상 이름

| 대상 | 예 |
|---|---|
| 단계 | `step:open`, `step:refresh`, `step:submit`(type), `step:zone:a`, `step:seat:a-B7`, `step:seat-ok`, `step:confirm`, `step:qty-plus`, `step:next`, `step:popup-ok`, `step:method:card`, `step:agree`, `step:pay`, `step:opt:{id}`, `step:hold` |
| 카드 | `card:{idx}:{part}` — `part`는 resolve 대상(`ok`, `allow`, `hide`), `submit`(type), `opt:{id}`(choose), 미끼(`open-tab`, `banner`) |

빗나간 탭은 UI가 엔진에 보내지 않는다 (game-rules §7).

## 6. 테스트 지도

| 테스트 | 파일 |
|---|---|
| 엔진 금지 규칙이 실제로 린트 오류를 냄 | `src/engine/lint-guard.test.ts` |
| 해시·PRNG 골든, 시드 형식 | `src/engine/rng.test.ts` |
| 스케줄 결정론·골든·스트림 독립성·1,000 시드 퍼징 | `src/engine/director.test.ts` |
| 상태 머신·정각 판정 경계·단계·카드 효과·런타임 불변식 | `src/engine/reducer.test.ts` |
| 리플레이 해시 (100 시드, 몽키 입력) | `src/engine/replay.test.ts` |
| 솔버 봇: 난이도 1~5 × 200 시드 검증 | `src/engine/solver.test.ts` |
| 튜토리얼: 고정 스케줄, 안내 봇 100% 성공 | `src/engine/tutorial.test.ts` |
| 저장소 (깨진 값·용량 초과·접근 불가) | `src/ui/storage.test.ts` |
| 공유 텍스트 형식·결정성 | `src/ui/share.test.ts` |
| 테마 대비 4.5:1 | `src/content/theme.test.ts` |
| e2e: 한 판 끝까지·튜토리얼·해금·설정·공유·localStorage 차단 | `e2e/*.spec.ts` |
| 금지어 검사기 | `src/content/forbidden.test.ts` |

밸런스 확인: `npx tsx scripts/balance-report.ts [stageId]` (솔버·보통 사람 봇의 남은 시간, 실제로 뜬 카드 수).
