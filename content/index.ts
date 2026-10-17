/**
 * 콘텐츠 원본 목록. 새 스테이지·카드 파일을 추가하면 여기에 한 줄 추가한다.
 * (Vite·Vitest·tsx 어디서나 같은 방식으로 읽히도록 정적 import만 쓴다)
 */
import ko from './copy/ko.json';
import director from './director.json';
import commonCards from './cards/common.cards.json';
import ticketingCards from './cards/ticketing.cards.json';
import courseRegCards from './cards/course-reg.cards.json';
import ticketingStage from './stages/ticketing.stage.json';
import tutorialStage from './stages/tutorial.stage.json';
import courseRegStage from './stages/course-reg.stage.json';
import ticketingIntro from './stages/fixed/ticketing-intro.json';
import tutorialFixed from './stages/fixed/tutorial.json';
import courseRegIntro from './stages/fixed/course-reg-intro.json';
import raspberryTheme from './themes/raspberry.json';
import slateTheme from './themes/slate.json';
import meadowTheme from './themes/meadow.json';

export const rawContent = {
  copy: ko as unknown,
  director: director as unknown,
  cardFiles: [
    { file: 'common.cards.json', data: commonCards as unknown },
    { file: 'ticketing.cards.json', data: ticketingCards as unknown },
    { file: 'course-reg.cards.json', data: courseRegCards as unknown },
  ],
  stageFiles: [
    { file: 'tutorial.stage.json', data: tutorialStage as unknown },
    { file: 'ticketing.stage.json', data: ticketingStage as unknown },
    { file: 'course-reg.stage.json', data: courseRegStage as unknown },
  ],
  fixedFiles: [
    { file: 'ticketing-intro.json', data: ticketingIntro as unknown },
    { file: 'tutorial.json', data: tutorialFixed as unknown },
    { file: 'course-reg-intro.json', data: courseRegIntro as unknown },
  ],
  themeFiles: [
    { file: 'raspberry.json', data: raspberryTheme as unknown },
    { file: 'slate.json', data: slateTheme as unknown },
    { file: 'meadow.json', data: meadowTheme as unknown },
  ],
};

export type RawContent = typeof rawContent;
