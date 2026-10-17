# 결정 0002: 구현 착수 시 정한 기본값 (2026-10-16)

상태: 확정(소유자 재검토 가능). 착수 프롬프트 §0에 따라 문서 사이 모순·모호점에 고른 기본값을 기록한다. 정본 문서는 해당 마일스톤에서 함께 고친다.

| # | 모순·모호점 | 선택 | 반영 시점 |
|---|---|---|---|
| 1 | 티켓팅 단계: `stage-format` 예시 `open→queue→captcha→zone→seat→pay` vs `realism-spec` `…→seat→price→buyer→pay` | **realism-spec** 채택(현실성 우선, 결정 0001). 구역 선택은 `seat` 단계 안의 탭 | M2 (stage-format 예시 수정) |
| 2 | `skippableAtLevel`·price/buyer용 step kind가 스키마에 없음 | step 선택 필드 `skippableAtLevel` 추가. `quantity` kind 추가, buyer는 `textInput`(6자리) | M2 |
| 3 | 근거 라벨: CLAUDE.md 5종 vs 스키마 3종 | enum을 `confirmed / secondary / memory / guess / unverified`로 확장 | M1 |
| 4 | `refresh-temptation` 예시가 `telegraphMs:0`인데 §5.5는 되돌림 카드에 ≥400 요구 | ≥400 규칙은 **만료 시 자동으로** 잠금·되돌림이 발동하는 카드에만 적용. `wait` 카드(플레이어가 건드려야만 실패)는 면제 | M1 |
| 5 | game-rules §6.3 "만료 시 미해결이면 실패"와 `wait`/`ignore` 카드 의미 충돌 | `wait`/`ignore`는 만료 = 해결. 대상 터치 = 실패(`wait`) 또는 시간 손실(`ignore`) | M1 |
| 6 | 쿨다운 기본 8초가 카드 스키마에 없음 | 카드 선택 필드 `cooldownMs`, 기본값은 `content/director.json` | M1 |
| 7 | 대기열 감소 속도 파라미터 없음 | `queue`에 `drainPerTick`, `segmentTicks`, 판정별 계수 표 추가 | M1 |
| 8 | `timer-squeeze`와 결제 기본 20초(400틱)가 중복 | 카드는 남은 결제 시간을 추가로 줄인다(`squeezeTicks`) | M2 |
| 9 | 튜토리얼: "과제 쉬운 변형" vs 각 스테이지 `difficulty[0].fixedSchedule` | 별도 `tutorial.stage.json`(가상 LMS, deadline 모드, 단일 체인, 1800틱, 카드 2장). `tutorial: true`면 difficulty 1개 허용. 다른 스테이지의 level 0은 UI에서 숨김 | M3 |
| 10 | 취켓팅 BONUS: game-rules엔 규칙, prototype-scope엔 범위 밖 | 상태 머신에 자리만 두고 미구현 | M1 |
| 11 | 저장 키 `daily` | 데일리 제외(결정 0001)라 미구현, 시드 형식만 호환 | M3 |
| 12 | 금지어 "목록은 저장소에 둔다" vs "코드에 실제 브랜드명 금지" | `scripts/forbidden-words.txt`(검사기 입력 전용, 스캔 제외). 스캔 범위: `src content public index.html spike.html README.md dist`. `docs/research`는 출처 기록이라 제외 | M0 |
| 13 | 공통 카드 수(문서마다 6/7/14) | 8개: messenger-ping, keyboard-cover, captcha, server-lag, timer-squeeze, popup-blocked, double-tab, rapid-click-limit | M2 |
| 14 | `common.kakao-ping`: 카드 ID에 실제 메신저 브랜드명 | `common.messenger-ping`으로 개명, 화면 문구는 "톡" 같은 일반어. 티켓팅 `family-ping`은 중복이라 제외 | M2 |
| 15 | 스파이크는 Playwright WebKit 지정, 환경에는 Chromium만 | 로컬은 Chromium iPhone 에뮬레이션, CI에 WebKit 참고 잡(비차단). 전 항목 "실기기 확인 필요" | M0 |
| 16 | SPA 새로고침 | 라우터 없이 상태 기반 화면 + `?seed=` 쿼리. `dist/404.html` 복사로 이중 안전 | M0 |
| 17 | 폰트 라이선스 미정 | 시스템 폰트 스택만 사용. `docs/assets-licenses.md`에 "외부 에셋 없음" | M0 |

## M1에서 추가된 결정

| # | 문제 | 선택 |
|---|---|---|
| 18 | 단계 전용 카드(window)를 판 시작 기준으로 배치하면 짧은 단계(대기열)를 지나친 뒤라 거의 뜨지 않는다 | window 카드는 **단계 진입 후 offset 틱**(`director.json` `stepAnchorOffsetTicks`)에 뜬다. 판 기준 카드만 램프를 따른다. 런타임이 슬롯·상호배제를 다시 지키고, 오래 밀린 카드는 `pendingMaxTicks` 뒤 건너뛴다 |
| 19 | 대기열 파라미터 `perfectFactor/slowFactor`만으로는 대기 시간을 정할 수 없음 | `factors`(시작 인원)와 `waitTicks`(판정별 평균 대기)를 분리. 표시 숫자는 크고 웃기게, 시간은 판 길이에 맞게 |
| 20 | 좌석 "이미 선택된 좌석입니다"를 어떻게 결정적으로 만들까 | 경쟁자가 가져가는 틱을 단계 진입 때 layout 스트림으로 미리 정하고, 화면 반영은 `revealLagTicks`만큼 늦다. 화면엔 빈자리인데 이미 팔린 좌석을 누르면 팝업 |
| 21 | 시너지 예시 "키보드 + 보안문자"가 `blocks-input` 상호배제와 충돌 | `keyboard-cover`는 `covers-confirm` 태그(입력창은 살아 있음)로 두고 `blocks-input`을 달지 않는다 |
| 22 | 램프 10/30/40/20(0–10/10–35/35–50/50–60초)이면 사람이 30초 안팎에 끝내는 판에서 후반 카드가 거의 안 뜬다 | 시작값을 15/40/35/10(0–10/10–25/25–40/40–60초)으로 당김. 봇에 사람 비용(반응·글자당 타이핑·화면 읽기)을 넣은 `humanish` 봇으로 확인. **플레이테스트로 재조정** |
| 23 | 입력 모델에 판 시작 행동이 없음 | `start` 행동 추가 (READY → PREROLL/RUNNING). READY에서는 틱이 흐르지 않는다 |

## M2에서 추가된 결정

| # | 문제 | 선택 |
|---|---|---|
| 24 | `seat-snipe`가 좌석을 고르기 전에 뜨면 "이미 선택된 좌석입니다"가 어색하다 | 활성 중 **다음에 고르는 빈 좌석**이 직전에 팔린다(`seatMap.snipeNext`). 카드는 화면 효과 없는 wait 카드, 팝업은 좌석 단계의 것 |
| 25 | 테마 id `ddakpyo`가 가상 브랜드 이름을 코드에 남긴다 | 테마 id는 팔레트 이름 `raspberry`. 브랜드 이름·URL 흉내는 `copy/ko.json` `brand.*`에만 |
| 26 | 게임 쪽 화면(HUD·홈·결과)과 가상 사이트 화면의 색 구분 | 가상 사이트는 `content/themes/*.json` → CSS 변수, 게임 쪽은 `src/index.css`의 `--color-game-*` 토큰 |

## M3에서 추가된 결정

| # | 문제 | 선택 |
|---|---|---|
| 27 | 해금(앞 스테이지 1회 시도) 때문에 친구가 보낸 시드 링크가 잠겨 있을 수 있다 | `?seed=` 링크로 들어온 스테이지는 잠겨 있어도 바로 할 수 있다. 홈의 해금 표시는 그대로 |
| 28 | 튜토리얼 안내 문구를 어디에 둘까 | 스테이지 데이터는 그대로 두고 문구 규약으로: `tutorial.hint.{stepId}`, `tutorial.hint.card.{cardId}`. 검증기가 튜토리얼의 모든 단계·카드에 안내가 있는지 확인 |
| 29 | 공유 코드의 버전 표시 (hazard §6 "v 접두") | 공유 링크에 `&v={contentVersion}`. 다르면 홈에 "다른 판이 될 수 있습니다" 안내. 문구만 바꾸면 버전이 변하지 않는다 |
| 30 | "한 줄 원인"의 출처 | 칭호 규칙의 `line`(웃음)과 별개로, 판이 끝난 이유·단계로 만든 사무적 원인 한 줄(`ui.cause.*`)을 함께 보여 준다 |
| 31 | 공유 한 줄 고르기 | `share.{stageId}.{n}` 중 copy 스트림으로 결정적으로 고른다 (같은 시드 = 같은 한 줄) |
