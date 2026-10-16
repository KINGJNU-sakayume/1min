# CLAUDE.md — 「1분 전」

개인용 코미디 캐주얼 웹게임. 한국인의 "1분짜리 지옥"(티켓팅, 수강신청, 과제 마감, 명절 기차표, 오픈런)을 60초 스테이지로 만든다.

## 정본은 docs/

설계는 `docs/`가 정본이다. 구현이 문서와 다르면 **문서를 먼저 고친다**(또는 `docs/decisions/`에 기록). 작업 전 반드시 읽을 것:

1. `docs/README.md` (문서 지도)
2. `docs/decisions/0001-owner-answers.md` (확정된 결정)
3. `docs/spec/game-rules.md`, `docs/spec/stage-format.md`, `docs/spec/realism-spec.md`
4. `docs/design/hazard-system.md`

## 스택과 환경

- Vite + React + TypeScript(strict) + Tailwind, Vitest, `zod`
- 서버·DB 없음. 저장은 localStorage(try/catch 필수, 실패해도 앱 동작)
- 배포: GitHub Actions → GitHub Pages (저장소 이름이 `1min`이므로 `base: '/1min/'`)
- 한국어 우선. 반응형 PC+모바일(아이폰 사파리 우선 검증), PWA

## 절대 규칙

1. **엔진은 결정론적**이다. `src/engine/**`에서 `Math.random`, `Date.now`, `performance.now`, `new Date()`를 쓰지 않는다 (ESLint `no-restricted-properties`로 강제). 난수는 시드 PRNG 스트림만 쓴다.
2. 엔진은 순수 함수 `step(state, input) → state'` 구조이고 DOM·React를 import하지 않는다.
3. 스테이지·카드·문구는 `content/` 의 JSON이며 zod로 검증한다. 문구를 코드에 하드코딩하지 않는다. 브랜드 이름은 `copy/ko.json`의 `brand.*`에만 둔다.
4. 현실성 수치(제한시간 등)는 JSON 파라미터. 코드에 상수로 박지 않는다.
5. **실제 브랜드·학교·인물의 이름, 로고, 고유 색 조합, 사진, 공지문 복사 금지** (공개 레포 + Pages). 일반 관용 표현은 허용. 체크리스트는 `docs/design/brand-and-tone.md` §5.
6. 매크로·우회·부정 구매를 가르치는 내용 금지(풍자는 허용).
7. 테스트 없이 엔진 로직을 추가하지 않는다. 새 카드/스테이지는 스키마 검증 + 솔버 봇 통과가 필수.

## 작업 방식

- 작게 나눠 커밋한다. 마일스톤마다 테스트가 통과한 상태로 커밋.
- 모르는 실제 서비스 디테일은 **지어내지 말고** `[미확인]`으로 두고 파라미터/스킨으로 분리한 뒤 소유자에게 질문한다.
- 근거 라벨(확인/2차/기억/추측/미확인)을 문서와 JSON `evidence`에 유지한다.
- 명령: `npm run dev`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` (스캐폴딩 후 이 목록을 실제 스크립트에 맞게 갱신할 것)
