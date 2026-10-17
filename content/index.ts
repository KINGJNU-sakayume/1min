/**
 * 콘텐츠 원본 목록. 새 스테이지·카드 파일을 추가하면 여기에 한 줄 추가한다.
 * (Vite·Vitest·tsx 어디서나 같은 방식으로 읽히도록 정적 import만 쓴다)
 */
import ko from './copy/ko.json';
import director from './director.json';
import commonCards from './cards/common.cards.json';
import ticketingCards from './cards/ticketing.cards.json';
import ticketingStage from './stages/ticketing.stage.json';
import ticketingIntro from './stages/fixed/ticketing-intro.json';

export const rawContent = {
  copy: ko as unknown,
  director: director as unknown,
  cardFiles: [
    { file: 'common.cards.json', data: commonCards as unknown },
    { file: 'ticketing.cards.json', data: ticketingCards as unknown },
  ],
  stageFiles: [{ file: 'ticketing.stage.json', data: ticketingStage as unknown }],
  fixedFiles: [{ file: 'ticketing-intro.json', data: ticketingIntro as unknown }],
};

export type RawContent = typeof rawContent;
