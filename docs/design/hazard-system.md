# 방해 요소 시스템 설계 (Hazard Cards)

상태: 초안 v0.1. 핵심 목표는 **카드처럼 섞어 매 판 다르게, 같은 시드면 항상 같게** 만드는 것이다.

## 1. 개념

| 용어 | 뜻 |
|---|---|
| **카드(Hazard Card)** | 방해 하나. 데이터로 정의한다. 코드 분기 없이 효과·해결법·실패 결과를 가진다. |
| **덱(Deck)** | 스테이지가 허용하는 카드 풀 + 가중치. 공통 카드와 스테이지 고유 카드를 섞는다. |
| **디렉터(Director)** | 시드와 난이도 예산으로 60초 타임라인에 카드를 배치하는 순수 함수. |
| **슬롯(Slot)** | 동시에 활성일 수 있는 카드 칸. 11:59식 "창이 쌓임"을 제한한다. |
| **텔레그래프(Telegraph)** | 카드가 활성화되기 직전의 예고(진동, 아이콘, 소리). 공정성의 핵심. |

## 2. 카드 분류 축

**표면(surface)**: 카드가 화면의 어디를 건드리는가
- `overlay` 팝업·모달이 덮음
- `input` 입력창·키보드·버튼을 가로챔
- `layout` 버튼 위치·크기·스크롤이 변함
- `time` 타이머·대기 숫자·시계가 왜곡됨
- `info` 잘못된 정보(오래된 재고, 틀린 시계)
- `ambient` 알림·전화·카톡 같은 외부 방해
- `reset` 진행 상태를 되돌림 (가장 아픈 카드, 예산이 큼)

**해결 방식(counter)**
- `tap` 정해진 대상을 탭 · `hold` 길게 누름 · `type` 입력 · `swipe` 쓸기
- `wait` **건드리지 않기** (새로고침 유혹 등)
- `choose` 선택지에서 올바른 것 고르기
- `ignore` 무시해도 되는 가짜 방해(오탐 유도)

**실패 결과(failEffect)**: 미해결 시 일어나는 일 — `lockMs`(입력 잠금), `penaltyMs`(시간 차감), `resetStep`(미션 단계 되돌림), `queueBack`(대기 순번 후퇴), `fatal`(즉시 실패).

## 3. 데이터 형식 (TypeScript 타입 초안)

JSON 콘텐츠를 `zod`로 검증하고 타입을 추론하는 방식을 권장한다. 아래는 정본 후보.

```ts
// content/schema/hazard.ts (초안, 구현 아님)
export type Surface = 'overlay'|'input'|'layout'|'time'|'info'|'ambient'|'reset';
export type Counter = 'tap'|'hold'|'type'|'swipe'|'wait'|'choose'|'ignore';

export interface HazardCard {
  id: string;                    // 'common.kakao-ping', 'ticketing.seat-snipe'
  version: number;               // 밸런스 변경 시 증가, 리플레이 호환 판단에 사용
  surface: Surface;
  counter: Counter;
  tags: string[];                // 조합 규칙용: 'blocks-input', 'timer', 'needs-keyboard' ...
  cost: number;                  // 난이도 예산 소비량 (1~5)
  weight: number;                // 덱 추첨 가중치
  minDifficulty: 1|2|3|4|5;
  stages: string[] | '*';        // 사용 가능한 스테이지
  telegraphMs: number;           // 예고 시간 (공정성 최소값은 §5 규칙)
  activeMs: number | null;       // 활성 지속, null이면 해결될 때까지
  window?: { fromStep?: string; toStep?: string }; // 특정 미션 단계 사이에서만
  effect: EffectSpec;            // 화면에 무슨 일이 일어나는가 (선언형)
  resolve: ResolveSpec;          // counter별 해결 조건
  failEffect: FailEffect;        // 미해결 결과
  exclusiveWith?: string[];      // 동시 활성 금지 태그/ID
  synergyWith?: { tag: string; bonusCost: number }[]; // 함께 나오면 '조합 이름' 부여
  copyKey: string;               // i18n 키. 문구는 콘텐츠로 분리
  evidence: Evidence;            // 근거 라벨 (아래)
  touchRisk?: 'keyboard'|'smallTarget'|'scrollTrap'|'pullToRefresh'|'multiTouch';
}

export interface Evidence {
  level: 'confirmed'|'secondary'|'guess';  // [확인]/[2차]/[추측]
  sources?: string[];                       // 'S6','S10'
}
```

### 예시 카드 (JSON)

```json
{
  "id": "ticketing.refresh-temptation",
  "version": 1,
  "surface": "layout",
  "counter": "wait",
  "tags": ["queue", "tempts-refresh"],
  "cost": 2,
  "weight": 10,
  "minDifficulty": 1,
  "stages": ["ticketing", "train"],
  "telegraphMs": 0,
  "activeMs": 6000,
  "window": { "fromStep": "queue" },
  "effect": { "kind": "wiggleButton", "target": "refreshBtn" },
  "resolve": { "kind": "avoidTap", "target": "refreshBtn" },
  "failEffect": { "kind": "queueBack", "amount": 4200 },
  "exclusiveWith": ["tag:blocks-input"],
  "copyKey": "haz.refresh.title",
  "evidence": { "level": "confirmed", "sources": ["S6", "S10"] },
  "touchRisk": "pullToRefresh"
}
```

## 4. 공통 카드 라이브러리 (스테이지 무관, 초안 14개)

| ID | 표면 | 해결 | 설명 | 근거 |
|---|---|---|---|---|
| common.kakao-ping | ambient | tap/ignore | 가족·친구 메시지 알림. 읽으면 시간 손실, 무시하면 안전. 하나는 진짜 필요한 안내 | [추측] |
| common.keyboard-cover | input | tap | 키보드가 올라와 확인 버튼을 가림. 키보드를 내려야 함 | [추측: 터치 특성] |
| common.timer-squeeze | time | — | 결제 제한이 20초로 압축 | [2차 S5] |
| common.server-lag | time | wait | 입력이 N초 뒤 반영 | [확인 S18, S25] |
| common.rapid-click-limit | input | wait | 광클 게이지가 차면 잠금 | [확인 S22] |
| common.captcha | input | type | 흐릿한 보안문자 | [확인 S4, S19] |
| common.popup-blocked | overlay | tap | "팝업이 차단되었습니다" 안내를 눌러야 진행 | [2차 S5] |
| common.fake-ad | overlay | tap | 닫기 버튼이 작고 위치가 이동 | [추측] |
| common.session-expired | reset | type | 로그인 풀림. 빠르게 재로그인 | [확인 S22] |
| common.stale-info | info | choose | 커뮤니티 정보가 오래돼 틀림 | [2차 S31] |
| common.wrong-clock | time | choose | 시계 둘이 서로 다름. 어느 쪽 신뢰 | [확인 S15] |
| common.battery-low | ambient | tap | 배터리 3%. 절전 모드 팝업이 화면을 덮음 | [추측] |
| common.double-tab | reset | wait | 다른 탭에서도 시도하면 둘 다 튕김 | [확인 S4, S24] |
| common.decoy | overlay | ignore | 중요해 보이지만 무시해야 하는 가짜 경고 | [추측] |

스테이지 고유 카드는 `design/stage-candidates.md`의 목록을 같은 형식으로 데이터화한다.

## 5. 조합 규칙 (디렉터의 제약)

1. **예산**: 난이도 `d`의 한 판은 총 카드 비용이 `budget(d, stage)`를 넘지 않는다. 판 길이 60초 중 시간 구간별 예산 가중치는 램프 곡선을 따른다 (→ `design/difficulty-results-touch.md`).
2. **슬롯**: 동시 활성 카드는 최대 `maxSlots`(난이도 1~2: 1, 3~4: 2, 5: 3). 11:59식 "창이 쌓임"은 5에서만.
3. **상호배제**: `blocks-input` 태그 카드끼리 동시 활성 금지. `reset` 카드는 최대 1개가 활성이고, 같은 판에서 `fatal`은 1회 이내.
4. **쿨다운**: 같은 카드 재등장은 최소 `cooldownMs`(기본 8초) 후. 같은 `surface` 연속 3회 금지(다양성).
5. **텔레그래프 최소값**: 입력을 잠그거나 되돌리는 카드는 `telegraphMs ≥ 400` (플레이어가 반응할 시간). 즉각 발동은 `ambient`·`overlay`처럼 가벼운 카드만.
6. **공정성(해결 가능성)**: 디렉터가 만든 모든 스케줄은 **최적 플레이 봇이 성공할 수 있어야** 한다. 봇이 실패하면 그 시드는 유효하지 않으며 다음 파생 시드로 재시도한다 (결정적이므로 재현 가능).
7. **시너지 이름**: `synergyWith`로 두 카드가 겹치면 결과 화면에 "조합 이름"(예: "키보드 + 보안문자 = 이중고")을 붙여 공유 소재로 쓴다. 비용 보너스로 난이도를 올린다.
8. **스토리 보장**: 한 판에 최소 1개의 **스테이지 고유 카드**를 반드시 포함해 "그 상황임"을 보장한다.
9. **튜토리얼**: 난이도 0은 카드 비용 상한이 낮고 해결책을 화면에 보여주며 반드시 성공 가능하도록 고정 스케줄을 쓴다.

## 6. 시드와 재현

- **시드 문자열**: `"{stageId}|{difficulty}|{code}"`. `code`는 공유 코드(영숫자 5~6자) 또는 날짜 `YYYYMMDD`(KST).
- **해시**: 문자열을 32비트 정수로 해시 (FNV-1a 같은 단순 해시 권장. 암호용 아님).
- **RNG**: `mulberry32` 같은 작은 PRNG. 외부 `Math.random` 금지.
- **스트림 분리**: 하나의 시드에서 용도별 스트림을 파생한다 (`director`, `layout`, `queue`, `copy`, `cosmetic`). 문구·연출을 바꿔도 카드 스케줄이 변하지 않게 한다.
- **스케줄은 판 시작 때 전부 계산**하고 불변 데이터로 보관한다. 이후 엔진은 이 스케줄을 읽기만 한다 → 테스트·리플레이가 쉽다.
- **버전 고정**: 스케줄 생성 결과에 `contentVersion`(카드·스테이지 버전 해시)을 기록한다. 밸런스를 바꾸면 오래된 공유 코드가 다른 판이 되므로 코드에 `v` 접두를 붙인다. 이 설계 때문에 카드 `version` 필드가 있다.

## 7. 결정론 엔진 구조 (설계)

- **고정 틱**: 논리 틱 50ms(20Hz), 60초 판 = 1,200틱. 렌더링(requestAnimationFrame)과 분리한다. 실제 시계 시간은 엔진 로직에 절대 쓰지 않는다.
- **엔진 = 순수 함수**: `step(state, inputs[tick]) → state'`. 부작용은 이벤트 배열로 바깥(UI·소리)에 내보낸다.
- **입력은 "논리 행동"**: `{tick, action:'tap', target:'seat:B12'}`. 터치 좌표는 UI 층이 해석한다. 그래서 작은 버튼 오조작은 UI의 재미이고 엔진은 결과만 안다.
- **입력 로그 = 리플레이**: `(seed, contentVersion, inputs[])`만 있으면 판을 재현하고 점수 해시가 같아야 한다.
- 장점: Vitest로 DOM 없이 수천 시드를 돌릴 수 있다.

## 8. 테스트 계획 (Vitest)

| 테스트 | 검증 |
|---|---|
| 스케줄 스냅샷 | 같은 시드 → 같은 카드 배열 (골든 파일) |
| 스트림 독립성 | 문구 스트림을 바꿔도 카드 스케줄 동일 |
| 예산·슬롯·쿨다운 | 1,000개 시드 퍼징에서 규칙 위반 0 |
| 상호배제 | `blocks-input` 동시 활성 0 |
| 솔버 봇 | 모든 유효 시드에서 봇이 성공 (공정성) |
| 튜토리얼 | 난이도 0에서 "아무것도 안 하고 안내대로만" 하면 성공 |
| 리플레이 | 입력 로그 재생 결과 해시 일치 |
| 콘텐츠 검증 | 모든 JSON이 스키마 통과. 스테이지마다 고유 카드 ≥5, 근거 라벨 존재 |

## 9. 확장 아이디어 (후순위)

- 카드 레어도: 드문 카드("서버 멀쩡함"이라는 행운 카드로 반전 개그)
- 플레이어 선택 카드: 판 시작 전 방해 3장 중 1장 "제거권" (설계 확장)
- 시즌 덱: 명절·개강 시즌에 덱 가중치 변경
