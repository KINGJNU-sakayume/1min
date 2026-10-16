# Claude Code 착수 프롬프트

사용법: 레포를 클론한 폴더에서 Claude Code를 열고, 아래 `---` 사이의 전체를 첫 메시지로 붙여넣는다. 짧게 시작하고 싶으면 `README`의 짧은 버전(채팅으로 전달)을 쓴다.

---

너는 1인 개발자의 페어 엔지니어다. 이 저장소(`1min`)는 「1분 전」이라는 개인용 코미디 웹게임이다. **코드는 아직 없고 설계 문서가 `docs/`에 있다.** 지금부터 1차 프로토타입을 구현한다.

## 0. 먼저 할 일 (코드 쓰기 전)

1. `CLAUDE.md`와 `docs/README.md`를 읽고, 문서 지도에 있는 아래 문서를 **전부** 읽어라: `docs/decisions/0001-owner-answers.md`, `docs/spec/game-rules.md`, `docs/spec/stage-format.md`, `docs/spec/realism-spec.md`, `docs/design/hazard-system.md`, `docs/design/difficulty-results-touch.md`, `docs/plan/prototype-scope.md`. `docs/research/*`는 근거가 필요할 때 참고한다.
2. 읽은 뒤 **구현 계획을 10줄 이내로 요약**하고, 문서 사이 모순이나 구현하기 모호한 지점이 있으면 목록으로 알려라. 치명적인 모호함이 아니면 합리적 기본값을 골라 기록하고 계속 진행해라. 소유자(나)에게 묻는 건 아래 §6 상황만.

## 1. 목표와 성공 기준

60초 한 판 게임을 아이폰 사파리와 PC 브라우저에서 돌린다. 증명할 것:

- **결정론**: 같은 시드 → 같은 카드 스케줄 → 같은 결과. 입력 로그 리플레이 해시가 일치한다(자동 테스트).
- **공정성**: 디렉터가 만든 모든 유효 시드를 솔버 봇이 성공시킨다(자동 테스트).
- **일반성**: 티켓팅 다음에 수강신청 스테이지를 **엔진 코어 변경을 최소**로 추가한다(변경량을 기록).
- **현실성**: `docs/spec/realism-spec.md`의 화면 시퀀스, 버튼명, 제한시간, 상태 전이를 데이터 파라미터로 구현한다.
- **웃음**: 결과 화면 칭호·한 줄 원인·시드 공유(텍스트 복사)가 동작한다.

## 2. 고정 제약

- Vite + React + TypeScript(strict) + Tailwind + Vitest + zod. 서버·DB 없음. localStorage는 try/catch 필수.
- GitHub Pages 배포(GitHub Actions). 저장소명이 `1min`이므로 Vite `base: '/1min/'`. 상대 경로 문제와 SPA 새로고침을 확인해라.
- 엔진(`src/engine/**`)은 DOM/React import 금지, `Math.random`·`Date.now`·`performance.now`·`new Date` 금지(ESLint로 강제하고, 위반 시 CI 실패). 시간은 틱(50ms)만 쓴다.
- 문구는 `content/copy/ko.json`, 스테이지는 `content/stages/*.stage.json`, 카드는 `content/cards/*.cards.json`. zod 스키마가 정본 타입이다(`docs/spec/stage-format.md`).
- 실제 브랜드명·로고·고유 색·인물명·공지문 복사 금지(공개 레포). 가상 이름은 `docs/design/brand-and-tone.md` §2. 브랜드 이름은 `copy/ko.json`의 `brand.*`에만 둔다. 빌드 시 금지어 검사 스크립트를 추가해라.
- 화면은 **PC와 모바일 모두 지원**(반응형). 엔진은 동일, 레이아웃 컴포넌트만 분기. 마우스/터치를 논리 행동(`tap`, `hold`, `type`, `swipe`, `open`)으로 변환한다.
- 현실성 수치(제한시간 등)는 JSON 파라미터. 코드에 하드코딩하지 마라.

## 3. 마일스톤 (각 끝에 `npm run lint && npm run typecheck && npm test`가 통과한 상태로 커밋)

**M0 — 셋업과 CI (반나절)**
- Vite 스캐폴딩, ESLint(엔진 금지 규칙 포함), Prettier, Vitest, Tailwind, zod.
- GitHub Actions: PR/푸시에서 lint·typecheck·test·build, `main` 푸시 시 Pages 배포.
- 완료 기준: 빈 앱이 Pages에 배포되고 CI가 초록.
- 같은 날 **모바일 스파이크**: Playwright(WebKit, iPhone 뷰포트)로 키보드 올라올 때 레이아웃(`visualViewport`), 오버스크롤(`overscroll-behavior`), 핀치 줌, 오디오 잠금 해제, Web Share/클립보드 폴백을 최소 페이지로 확인하고 결과를 `docs/design/difficulty-results-touch.md` §4.3에 표로 기록한다. **실제 iOS 사파리 동작은 Playwright로 확정할 수 없으니, 확정 못 한 항목은 "실기기 확인 필요"로 남겨라.**

**M1 — 엔진 코어 (1~2일, 테스트 우선)**
- 시드 문자열 해시(FNV-1a류) + PRNG(mulberry32류) + 용도별 스트림 분리(`director`, `layout`, `queue`, `copy`, `cosmetic`).
- 디렉터: 예산·슬롯·쿨다운·상호배제·텔레그래프 최소값·고유 카드 보장(`docs/design/hazard-system.md` §5). 스케줄은 판 시작 때 전부 계산해 불변 데이터로 둔다.
- `step(state, input)` 순수 리듀서: 상태 머신 READY→PREROLL→RUNNING→RESULT, 미션 체인, 정각 판정, 카드 상태(텔레그래프→활성→해결/실패), 효과 적용.
- 입력 로그/리플레이 + 결과 해시.
- 테스트: 스케줄 골든 스냅샷, 스트림 독립성(문구 스트림을 바꿔도 스케줄 동일), 1,000 시드 퍼징(규칙 위반 0), 리플레이 해시 일치, **솔버 봇** 구현(해결 가능 시드만 유효, 아니면 파생 시드로 재시도).

**M2 — 티켓팅 수직 슬라이스 (2~3일)**
- `docs/spec/realism-spec.md` §1대로: 예매하기 → 대기 → 안심예매 문자 입력("입력완료") → 좌석선택완료 → 가격(수량 0매 함정) → 주문자 → 결제하기.
- 공통 카드 8개 + 고유 카드 5개 이상을 **데이터로** 정의하고 UI 컴포넌트(오버레이, 대기 숫자, 좌석도, 결제 타이머)를 만든다.
- PC 레이아웃(창/패널)과 모바일 레이아웃(전체 화면 단계)을 둘 다 구현.
- 완료 기준: 손으로 한 판을 끝까지 플레이할 수 있고, 같은 시드가 같은 판을 만든다.

**M3 — 튜토리얼, 결과, 공유, 저장 (1~2일)**
- 난이도 0 튜토리얼(고정 스케줄, "안내대로 하면 반드시 성공"을 테스트로 고정).
- 결과 화면: 칭호·한 줄 원인·타임라인 이모지·시너지 이름, "한 번 더"/"같은 판 복수전". 텍스트 공유(Web Share → 클립보드 폴백), 시드 코드 입력.
- localStorage: 진행·설정·최근 기록(용량 제한 N≤100). 접근성: 시간 연장, 모션 감소.

**M4 — 수강신청 스테이지 (2일, 일반성 검증)**
- `docs/spec/realism-spec.md` §2의 신청 결과 모델(`idle→pending→success|full|blocked|notPeriod`)을 데이터 주도로 구현.
- **엔진 코어(src/engine)의 변경을 최소화**하고, 변경이 필요했던 지점과 이유를 `docs/decisions/0002-engine-generality.md`에 기록한다.

**M5 — PWA와 마감 (1일)**
- 매니페스트, 서비스 워커(오프라인 실행), 홈 화면 추가 확인 항목 정리.
- 법·윤리 체크리스트(`brand-and-tone.md` §5) 점검, 금지어 검사 통과, `README.md`에 오마주 문구 TODO.

기차표·과제·한정빵 스테이지는 **이번 범위 밖**이다. 하지 마라.

## 4. 품질 규칙

- 테스트 없이 엔진 로직을 추가하지 마라. 새 카드/스테이지는 스키마 검증 + 솔버 봇 통과가 필수.
- `any` 금지, 비어 있는 `catch` 금지(localStorage는 의도적 무시 시 주석).
- 큰 변경 전에는 파일/모듈 구조를 먼저 제안해라(`docs/spec/architecture.md`를 만들어 기록).
- 문서와 구현이 달라지면 코드를 고치기 전에 문서를 고치거나 `docs/decisions/`에 기록해라.
- 근거 라벨(확인/2차/기억/추측/미확인)을 JSON `evidence`에 유지해라. 모르는 실제 서비스 디테일을 지어내지 말고 `[미확인]`으로 남겨 파라미터/스킨으로 분리해라.

## 5. 커밋과 보고

- 마일스톤 단위로 작은 커밋. 메시지는 `feat(engine): …` 형식. `main`에 직접 푸시하지 말고 `feat/m1-engine` 같은 브랜치에서 작업한 뒤 PR을 만들어라(내가 병합한다).
- 마일스톤이 끝날 때마다 한 단락으로 보고: 무엇이 동작하는지, 테스트 수, 남은 위험, 내가 확인해야 할 것(특히 실기기 확인 항목).

## 6. 나에게 물어야 하는 경우 (그 외에는 묻지 말고 진행)

- 실제 서비스 화면을 봐야만 정할 수 있는 디테일(레이아웃 비율, 문구 위치 등): 스킨 값으로 분리해 두고 목록으로 모아 마일스톤 보고에 포함해라.
- 범위를 늘려야 하는 경우, 법·윤리 선(실제 브랜드 사용 등)을 넘는 요구가 생긴 경우.

시작해라. 먼저 §0을 하고 요약을 보고한 뒤 M0부터 진행해라.

---
