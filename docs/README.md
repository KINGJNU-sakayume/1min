# 「1분 전」 설계 문서 (정본)

한국인만 아는 1분짜리 지옥(티켓팅·수강신청·과제 마감·명절 기차표·오픈런)을 스테이지로 만든 코미디 캐주얼 게임.
원석: GMTK Game Jam 2026 「11:59」(오마주 문구 TODO, 결정 0001). 이 폴더가 설계의 **정본**이다.

상태: 초안 v0.2 (2026-10-17) · 개인용 · 구현 진행 중 (M2 티켓팅)

## 문서 지도

| 문서 | 내용 | 상태 |
|---|---|---|
| `decisions/0001-owner-answers.md` | **소유자 답변과 설계 반영** (개인용, PC+모바일, 현실성 우선) | 확정 |
| `research/pain-points-and-references.md` | 조사 보고서: 고통 포인트·밈·출처, 기존 연습 사이트, 참고 게임, 법·윤리 | 초안 |
| `research/realism-findings.md` | **현실성 보강 조사**: 실제 단계·버튼명·제한시간·증상 (S47~S60) | 초안 |
| `spec/realism-spec.md` | **현실성 명세**: 스테이지별 화면 시퀀스, 상태 전이, 파라미터 | 초안 · 정본 |
| `spec/game-rules.md` | 핵심 1: 게임 규칙 | 초안 · 정본 |
| `spec/stage-format.md` | 핵심 2: 스테이지 작성 형식 (JSON 스키마 + 예시) | 초안 · 정본 |
| `design/stage-candidates.md` | 스테이지 후보 10개, 비교표, 1차 출시 5개 | 초안 |
| `design/hazard-system.md` | 방해 요소 카드, 조합 규칙, 시드 재현, 테스트 계획 | 초안 |
| `design/stages/ticketing.md` | 티켓팅 실제 화면 대조표·소유자 확인 목록 | 초안 |
| `design/brand-and-tone.md` | 가상 브랜드·화면 톤, 문구 샘플, 법·윤리 체크리스트 | 초안 |
| `design/difficulty-results-touch.md` | 난이도 곡선, 결과 화면, 공유 카드, 터치 재미 | 초안 |
| `plan/prototype-scope.md` | 1차 프로토타입 범위 (1–2주) | 초안 |
| `plan/claude-code-prompt.md` | **Claude Code에 줄 착수 프롬프트** | 초안 |
| `spec/architecture.md` | 코드 구조·한 틱의 순서·테스트 지도 | 구현 정본 |
| `decisions/0002-implementation-defaults.md` | 착수 시 모순·모호점에 고른 기본값 | 확정 |
| `assets-licenses.md` | 에셋 라이선스 기록 | 유지 |

## 앞으로 만들 문서

`spec/engine-api.md`, `spec/testing.md`, `spec/save-data.md`, `design/copy-bible.md`, `design/ui-kit.md`, `design/stages/course-reg.md`, `plan/playtest-log.md`, `plan/release-checklist.md`, `decisions/NNNN-*.md`

## 라벨 규칙

**[확인]** 공식 공지·언론 · **[2차]** 블로그·후기·SNS · **[기억]** 내 사전지식(출처 미확인) · **[추측]** 내 추론 · **[미확인]** 못 찾음. 출처 ID `S#`는 조사 보고서 §10과 `realism-findings.md` §6.
