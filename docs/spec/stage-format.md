# 스테이지 작성 형식 (핵심 문서 2/2)

상태: 초안 v0.1 · 정본. 스테이지 콘텐츠는 **JSON 파일**이고, 빌드 때 `zod` 스키마로 검증한다. (코드 구현은 아직 없음.)
관련: `spec/game-rules.md`, `design/hazard-system.md`

## 1. 파일 위치와 이름

```
content/
  stages/
    tutorial.stage.json
    ticketing.stage.json
    course-reg.stage.json
    homework.stage.json
    train.stage.json
    convenience-bread.stage.json
  cards/
    common.cards.json         # 공통 카드
    ticketing.cards.json      # 스테이지 고유 카드 (스테이지당 1파일)
  copy/
    ko.json                   # 문구 (i18n 키 → 한국어)
  schema/
    stage.ts, card.ts, copy.ts  # zod 스키마 (정본 타입)
```

- 파일 이름은 `{id}.stage.json`. `id`는 소문자·하이픈.
- 문구는 스테이지 JSON에 직접 쓰지 않고 `copy/ko.json`의 키로 참조한다 (문구만 바꿔도 시드 결과가 안 변하게 하기 위함).

## 2. 최상위 필드

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `id` | string | ✔ | 스테이지 ID. 시드 문자열에 들어간다. 바꾸면 기존 공유 코드가 깨진다. |
| `version` | integer | ✔ | 밸런스·구조를 바꾸면 +1. |
| `mode` | `"open"` \| `"deadline"` | ✔ | 정각 오픈형 / 마감형 |
| `title` | copy key | ✔ | 스테이지 이름 |
| `brand` | object | ✔ | 가상 브랜드 정보 (아래 §3) |
| `durationTicks` | integer | ✔ | 기본 1200 (60초). 튜토리얼은 1800 가능 |
| `steps` | array | ✔ | 미션 체인 (§4) |
| `lanes` | array | | deadline 모드 병렬 과제 (§4.2) |
| `deck` | object | ✔ | 사용 카드 풀 (§5) |
| `difficulty` | array[6] | ✔ | 난이도 0~5 파라미터 (§6) |
| `results` | array | ✔ | 결과 칭호 조건 (§7) |
| `theme` | object | ✔ | 화면 테마 토큰 참조 |
| `evidence` | array | ✔ | 근거 목록 (출처 ID와 라벨) |
| `legal` | object | ✔ | 법·윤리 체크리스트 상태 (§9) |

## 3. `brand` (가상 브랜드)

```json
"brand": {
  "name": "copy:brand.ticketing.name",
  "fictional": true,
  "disclaimer": "copy:common.parodyNotice",
  "forbidden": ["실제 예매처명", "아티스트 실명"]
}
```
- `fictional`은 항상 `true`. 검증기가 `false`를 허용하지 않는다.
- `forbidden`은 **금지어 검사용 목록**이다. 빌드 시 모든 문구·파일명·메타에서 해당 단어가 나오면 실패한다 (예: 린트 스크립트). 실제 목록은 저장소에 두되 이 문서에는 예시만 둔다.

## 4. `steps` (미션 체인)

```json
"steps": [
  { "id": "open",    "kind": "openButton", "completesWhen": { "type": "openJudged" } },
  { "id": "queue",   "kind": "queue",      "completesWhen": { "type": "queueZero" }, "queue": { "base": 12000, "perfectFactor": 0.01, "slowFactor": 1.0 } },
  { "id": "captcha", "kind": "textInput",  "completesWhen": { "type": "inputMatches", "length": 5 } },
  { "id": "zone",    "kind": "choose",     "completesWhen": { "type": "pick", "from": "zones" } },
  { "id": "seat",    "kind": "seatMap",    "completesWhen": { "type": "seatHeld" } },
  { "id": "pay",     "kind": "payment",    "completesWhen": { "type": "paid" }, "timeLimitTicks": 400 }
]
```

- `kind`는 UI 컴포넌트와 연결되는 **미리 정의된 종류**만 허용한다 (`openButton`, `queue`, `textInput`, `choose`, `seatMap`, `payment`, `upload`, `timetable`, `map` 등). 스테이지 작성자가 새 종류를 만들면 코드 변경이 필요하다.
- `completesWhen`은 **선언형 조건**이다. 스크립트·함수는 허용하지 않는다. 엔진이 조건 이름별 핸들러를 가진다.
- `timeLimitTicks`: 해당 단계에 진입한 뒤 제한 시간 (결제 타이머 등).

### 4.2 `lanes` (deadline 모드)

```json
"lanes": [
  { "id": "hw1", "steps": ["prepare", "convert", "upload"], "spawnTick": 0 },
  { "id": "hw2", "steps": ["prepare", "convert", "upload"], "spawnTick": 240 },
  { "id": "hw3", "steps": ["prepare", "convert", "upload"], "spawnTick": 480 }
]
```
- 모든 레인 완료 = 성공. 레인이 나중에 생기는 "늘어나는 과제"를 표현한다 (원작 11:59의 아이디어에서 영감, 구현은 독자 설계).

## 5. `deck` (카드 풀)

```json
"deck": {
  "common": ["common.kakao-ping", "common.keyboard-cover", "common.captcha", "common.server-lag", "common.timer-squeeze", "common.popup-blocked"],
  "specific": ["ticketing.refresh-temptation", "ticketing.seat-snipe", "ticketing.zone-click-limit", "ticketing.one-account-one-queue", "ticketing.family-seat-rule"],
  "mustInclude": { "specificMin": 1 },
  "weightOverrides": { "ticketing.seat-snipe": 20 }
}
```
- **스테이지 고유 카드는 5개 이상**(작성 규칙). 각 카드는 `content/cards/{stage}.cards.json`에 정의한다.
- `weightOverrides`는 카드 기본 가중치를 스테이지 단위로 조정한다.

## 6. `difficulty` (0~5)

```json
"difficulty": [
  { "level": 0, "budget": 3,  "maxSlots": 1, "fixedSchedule": "tutorial" },
  { "level": 1, "budget": 6,  "maxSlots": 1 },
  { "level": 2, "budget": 10, "maxSlots": 1 },
  { "level": 3, "budget": 14, "maxSlots": 2 },
  { "level": 4, "budget": 18, "maxSlots": 2 },
  { "level": 5, "budget": 22, "maxSlots": 3 }
]
```
- 값은 `design/difficulty-results-touch.md` §1.2의 시작값이다. 배열 길이는 6이어야 한다.
- `fixedSchedule`이 있으면 디렉터가 아니라 `content/stages/fixed/{name}.json`의 고정 스케줄을 쓴다.

## 7. `results` (결과 칭호)

```json
"results": [
  { "id": "success-close",   "when": { "outcome": "success", "remainingTicksLte": 60 },  "title": "copy:result.ticketing.successClose", "line": "copy:result.ticketing.successClose.line" },
  { "id": "success-perfect", "when": { "outcome": "success", "remainingTicksGte": 300 }, "title": "copy:result.ticketing.successPerfect" },
  { "id": "fail-sniped",     "when": { "outcome": "fail", "failedCardIncludes": "ticketing.seat-snipe", "minCount": 2 }, "title": "copy:result.ticketing.failSniped" },
  { "id": "fail-queue",      "when": { "outcome": "fail", "reason": "queueReset" }, "title": "copy:result.ticketing.failQueue" },
  { "id": "fail-default",    "when": { "outcome": "fail" }, "title": "copy:result.ticketing.failDefault" }
]
```
- 위에서부터 첫 일치 결과를 사용한다. **마지막 항목은 반드시 무조건 일치하는 기본값**이어야 한다 (`outcome`만 있는 조건).
- 성공/실패 각각 최소 3개 칭호를 권장한다.

## 8. `theme`

```json
"theme": { "tokens": "dd-pyo", "seatShape": "jellybean", "font": "copy:font.default" }
```
- 토큰 세트는 Tailwind 테마 변수 이름. 실제 색 값은 `design/brand-and-tone.md` 가이드에 따라 따로 정의한다.

## 9. `evidence`와 `legal`

```json
"evidence": [
  { "claim": "대기열 중 새로고침 시 순번 초기화 공포", "level": "confirmed", "sources": ["S6", "S10"] },
  { "claim": "서버 지연 스피너", "level": "confirmed", "sources": ["S18", "S25"] },
  { "claim": "카톡 알림 오버레이", "level": "guess" }
],
"legal": {
  "noRealBrands": true,
  "noRealPeople": true,
  "noRealInputRequested": true,
  "disclaimerShown": true,
  "assetLicenses": "docs/assets-licenses.md",
  "reviewedAt": "2026-10-16"
}
```
- `level`은 `confirmed | secondary | guess`. 출처 ID는 `docs/research/pain-points-and-references.md` 목록을 따른다.
- `legal`의 불리언 중 하나라도 `false`이면 **빌드가 실패**한다. 병합 게이트는 `design/brand-and-tone.md` §5.

## 10. 검증 규칙 (zod + 추가 검사)

1. `id`는 파일명과 일치.
2. `steps`의 `id`가 중복되지 않고, `deck.specific`의 모든 카드가 존재함.
3. 스테이지 고유 카드 개수 ≥ 5.
4. 모든 카드·스테이지에 `evidence`가 있음.
5. `results`의 마지막이 기본값 조건.
6. `difficulty`가 6개이고 `budget`이 단조 증가.
7. 문구 키가 `copy/ko.json`에 모두 존재.
8. 금지어 검사 통과.
9. **솔버 봇이 난이도 1~5 샘플 시드 N개(예: 200)에서 성공**해야 함 (해결 가능성 보장).
10. 튜토리얼은 "안내대로만" 하는 봇으로 100% 성공.

## 11. 작성 체크리스트 (새 스테이지 PR용)

- [ ] 한 줄 컨셉과 "이거 나잖아" 포인트를 적었다
- [ ] 미션 체인 3~7단계, 60초에 가능
- [ ] 고유 카드 5개 이상, 각 카드의 `counter`·`failEffect`·`evidence` 있음
- [ ] 결과 칭호 성공 3 + 실패 5 이상, 공유 한 줄 2개 이상
- [ ] 가상 브랜드명과 테마 토큰 정의
- [ ] 법·윤리 체크 통과 (`legal` 필드)
- [ ] 솔버 봇·퍼징 테스트 통과
- [ ] 플레이테스트 3명 이상 (성공률이 난이도 목표 범위)

## 12. 완성 예시 (축약판)

`content/stages/ticketing.stage.json`

```json
{
  "id": "ticketing",
  "version": 1,
  "mode": "open",
  "title": "copy:stage.ticketing.title",
  "brand": { "name": "copy:brand.ticketing.name", "fictional": true, "disclaimer": "copy:common.parodyNotice", "forbidden": [] },
  "durationTicks": 1200,
  "steps": [
    { "id": "open",    "kind": "openButton", "completesWhen": { "type": "openJudged" } },
    { "id": "queue",   "kind": "queue",      "completesWhen": { "type": "queueZero" }, "queue": { "base": 12000, "perfectFactor": 0.01, "slowFactor": 1.0 } },
    { "id": "captcha", "kind": "textInput",  "completesWhen": { "type": "inputMatches", "length": 5 } },
    { "id": "zone",    "kind": "choose",     "completesWhen": { "type": "pick", "from": "zones" } },
    { "id": "seat",    "kind": "seatMap",    "completesWhen": { "type": "seatHeld" } },
    { "id": "pay",     "kind": "payment",    "completesWhen": { "type": "paid" }, "timeLimitTicks": 400 }
  ],
  "deck": {
    "common": ["common.kakao-ping", "common.keyboard-cover", "common.captcha", "common.server-lag", "common.timer-squeeze", "common.popup-blocked", "common.double-tab"],
    "specific": ["ticketing.refresh-temptation", "ticketing.seat-snipe", "ticketing.zone-click-limit", "ticketing.one-account-one-queue", "ticketing.family-seat-rule"],
    "mustInclude": { "specificMin": 1 },
    "weightOverrides": { "ticketing.seat-snipe": 20 }
  },
  "difficulty": [
    { "level": 0, "budget": 3,  "maxSlots": 1, "fixedSchedule": "tutorial" },
    { "level": 1, "budget": 6,  "maxSlots": 1 },
    { "level": 2, "budget": 10, "maxSlots": 1 },
    { "level": 3, "budget": 14, "maxSlots": 2 },
    { "level": 4, "budget": 18, "maxSlots": 2 },
    { "level": 5, "budget": 22, "maxSlots": 3 }
  ],
  "results": [
    { "id": "success-close",   "when": { "outcome": "success", "remainingTicksLte": 60 },  "title": "copy:result.ticketing.successClose" },
    { "id": "success-perfect", "when": { "outcome": "success", "remainingTicksGte": 300 }, "title": "copy:result.ticketing.successPerfect" },
    { "id": "success-default", "when": { "outcome": "success" }, "title": "copy:result.ticketing.successDefault" },
    { "id": "fail-sniped",     "when": { "outcome": "fail", "failedCardIncludes": "ticketing.seat-snipe", "minCount": 2 }, "title": "copy:result.ticketing.failSniped" },
    { "id": "fail-queue",      "when": { "outcome": "fail", "reason": "queueReset" }, "title": "copy:result.ticketing.failQueue" },
    { "id": "fail-timeout",    "when": { "outcome": "fail", "reason": "timeout" }, "title": "copy:result.ticketing.failTimeout" },
    { "id": "fail-default",    "when": { "outcome": "fail" }, "title": "copy:result.ticketing.failDefault" }
  ],
  "theme": { "tokens": "dd-pyo", "seatShape": "jellybean", "font": "copy:font.default" },
  "evidence": [
    { "claim": "대기열 새로고침 공포", "level": "confirmed", "sources": ["S6", "S10"] },
    { "claim": "1계정 1대기열", "level": "confirmed", "sources": ["S4"] },
    { "claim": "좌석 경합", "level": "guess" }
  ],
  "legal": { "noRealBrands": true, "noRealPeople": true, "noRealInputRequested": true, "disclaimerShown": true, "assetLicenses": "docs/assets-licenses.md", "reviewedAt": "2026-10-16" }
}
```

## 13. 변경 기록

- 2026-10-16 v0.1 초안
