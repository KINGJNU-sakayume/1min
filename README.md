# 1분 전

한국인만 아는 1분짜리 지옥(티켓팅·수강신청·과제 마감·명절 기차표·오픈런)을 스테이지로 만든 개인용 코미디 웹게임. 모든 브랜드와 인물은 가상이며 실제 서비스와 무관한 패러디입니다.

원작 오마주: TODO (GMTK Game Jam 2026 「11:59」)

## 상태

1차 프로토타입: 튜토리얼(과제 제출) · 콘서트 티켓팅 · 대학 수강신청. PC와 모바일(아이폰 사파리 우선) 반응형, 오프라인 실행(PWA).

- 같은 시드 코드 = 같은 판. 결과 화면에서 시드가 담긴 링크를 공유할 수 있습니다.
- 설정: 시간 연장(90초), 움직임 줄이기, 소리 끄기.
- 서버·계정·분석 도구 없음. 기록은 이 기기의 브라우저에만 저장됩니다.

## 개발

```bash
npm ci
npm run dev          # http://localhost:5173/1min/
npm test             # Vitest (엔진·콘텐츠·저장·공유)
npm run lint && npm run typecheck
npm run build        # 콘텐츠 검사(스키마·금지어) + 빌드 + 404.html + sw.js
npm run e2e          # Playwright (빌드 후)
npx tsx scripts/balance-report.ts ticketing   # 밸런스 리포트
```

`main`에 푸시하면 GitHub Actions가 GitHub Pages로 배포합니다 (저장소 Settings → Pages → Source: GitHub Actions).

## 문서

설계 정본: [`docs/README.md`](docs/README.md) · 구조: [`docs/spec/architecture.md`](docs/spec/architecture.md) · 에이전트 지침: [`CLAUDE.md`](CLAUDE.md) · 출시 점검: [`docs/plan/release-checklist.md`](docs/plan/release-checklist.md)
