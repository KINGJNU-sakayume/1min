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
