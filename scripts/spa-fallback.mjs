// GitHub Pages는 SPA 라우팅을 모르므로 404.html을 index.html과 같게 둔다.
// (앱은 라우터 없이 상태·쿼리 문자열만 쓰지만 이중 안전장치)
import { copyFileSync } from 'node:fs';

copyFileSync('dist/index.html', 'dist/404.html');
console.log('dist/404.html 생성');
