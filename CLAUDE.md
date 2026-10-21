# 오늘의 강의

- 사이트명: **오늘의 강의**
- 화면 제목(`<h1>`)과 `<title>`은 "오늘의 강의"로 쓴다. 예: `<title>오늘의 강의 - 개발 강의 검색기</title>`

검색어(예: "react 입문")를 입력하면 관련 개발 강의 영상을 카드 목록으로 보여주는 **HTML + CSS + JS 파일로만 만든** 페이지. API 키는 `config.js`에서 불러온다.

## 프로젝트 목표
- 프론트엔드 개발자가 강의를 찾는 용도의 검색 도구
- 빌드 도구, 프레임워크, 서버 코드 없이 정적 파일만으로 동작
- 학습 포인트: API 키 발급, `config.js`로 설정 분리, 키 제한 설정, 검색 결과 카드 렌더링

## 기술 스택
- HTML, CSS, JavaScript (바닐라)
- 외부 라이브러리와 CDN은 사용하지 않는다
- 데이터: YouTube Data API v3 (API 키 필요)
- 배포: Netlify (GitHub 저장소 연결, `main` 브랜치 push 시 자동 배포)
- Netlify Functions 등 서버 코드는 만들지 않는다 (`netlify/` 폴더 생성 금지)

## 파일 구조
```
(현재 작업 폴더)/
├── index.html   # 화면 구조(HTML)만 작성
├── style.css    # 스타일
├── config.js    # API 키 등 설정값 (로컬 전용, GitHub에 올리지 않음)
├── app.js       # API 호출, 데이터 가공, 화면 그리기
├── netlify.toml # 배포 때 Netlify가 config.js를 만들도록 하는 빌드 설정
├── .gitignore   # config.js를 Git에서 제외
└── CLAUDE.md
```
- 이 7개 파일 외에 다른 파일(폴더, 추가 JS/CSS)을 만들지 않는다. 더 필요하면 먼저 사용자에게 묻는다.
- `index.html`에서 연결 순서는 반드시 `config.js` → `app.js`다. (`app.js`가 `CONFIG`를 쓰기 때문)
  ```html
  <link rel="stylesheet" href="style.css">
  <script src="config.js"></script>
  <script src="app.js" defer></script>
  ```
  `defer`가 붙은 `app.js`는 HTML을 다 읽은 뒤에 실행되므로, 먼저 실행돼야 하는 `config.js`에는 `defer`를 붙이지 않는다.
- `<style>`, `<script>` 안에 코드를 직접 쓰지 않는다.

## config.js 규칙
```js
// config.js : 설정값 모음
const CONFIG = {
  YOUTUBE_API_KEY: "여기에_발급받은_키",
  MAX_RESULTS: 12,
};
```
- API 키 등 설정값은 `app.js`에 직접 쓰지 않고 `CONFIG.YOUTUBE_API_KEY`로만 사용한다.
- `config.js`에는 이 프로젝트의 YouTube API 키만 넣는다. 다른 서비스의 키, 비밀번호, 토큰은 절대 넣지 않는다.
- 키가 비어 있거나 `"여기에_발급받은_키"` 그대로면, 검색 시 "config.js에 API 키를 입력해 주세요" 안내를 화면에 표시한다.

## 보안 규칙 (중요)
- **`config.js`는 브라우저로 그대로 내려가는 파일이다.** 배포하면 누구나 개발자도구나 주소 뒤에 `/config.js`를 붙여 키를 볼 수 있다. 키가 숨겨지는 것이 아니라 코드와 분리만 된다.
- 그래서 **키에 반드시 제한을 건다** (Google Cloud Console의 API 키 설정에서 확인):
  1. 애플리케이션 제한: **HTTP 리퍼러(웹사이트)** 로 설정하고, 허용 주소에 배포 주소(`https://사이트이름.netlify.app/*`)와 로컬 테스트 주소(`http://localhost:*`, 사용 시)만 등록
  2. API 제한: **YouTube Data API v3**만 선택
  - 제한을 건 키는 다른 사이트에서 도용해도 동작하지 않는다. 설정 화면의 메뉴 이름과 위치는 바뀔 수 있으니 구글 공식 안내를 따른다.
- **제한을 걸지 않은 키는 GitHub에 커밋하지 않는다.** 한 번 커밋된 키는 파일을 고쳐도 커밋 기록에 남는다. 키가 노출됐다면 Cloud Console에서 키를 삭제하고 재발급한다.
- 사용량 한도(쿼터)를 소진당할 수 있다는 점을 알고, Cloud Console에서 사용량을 가끔 확인한다.
- `config.js`는 `.gitignore`로 GitHub에서 제외한다. 배포 때는 `netlify.toml`의 빌드 명령이 Netlify의 환경변수 `YOUTUBE_API_KEY`로 `config.js`를 새로 만든다. 그래서 저장소에는 키가 남지 않는다.
- 하지만 배포된 `config.js`는 여전히 누구나 내려받을 수 있다. 환경변수를 써도 키가 숨겨지는 것은 아니므로 위의 키 제한은 그대로 필수다.

## 사용하는 API
| 용도 | 엔드포인트 |
|---|---|
| 영상 검색 | `GET https://www.googleapis.com/youtube/v3/search` |

쿼리 파라미터:
- `part=snippet`, `type=video`, `q={검색어}`, `maxResults={CONFIG.MAX_RESULTS}`, `key={CONFIG.YOUTUBE_API_KEY}`
- 선택: `order=relevance|date`(정렬), `relevanceLanguage=ko`(한국어 우선)
- URL은 `new URL()`과 `url.searchParams.set()`으로 만들어 검색어가 자동으로 인코딩되게 한다.

사용할 응답 필드 (실제 응답으로 확인 후 사용):
- `items[].id.videoId`, `items[].snippet.title`, `items[].snippet.channelTitle`, `items[].snippet.publishedAt`, `items[].snippet.thumbnails.medium.url`
- 영상 링크: `https://www.youtube.com/watch?v={videoId}`

확인되지 않은 사항 (구현 전 공식 문서와 실제 호출로 확인하고 결과를 이 파일에 기록한다):
- 검색 1회당 소모되는 쿼터(하루 한도 대비). 공식 문서: https://developers.google.com/youtube/v3/docs/search/list
- 응답 `title`에 `&amp;`, `&#39;` 같은 HTML 문자 코드가 섞여 나오는지. 섞여 있으면 `DOMParser`로 해석한 텍스트를 `textContent`로 넣는다.
- 키 제한(HTTP 리퍼러)이 로컬 `file://` 방식 열기에서도 동작하는지. 안 되면 로컬에서는 간단한 로컬 서버(예: VS Code Live Server)로 연다.

## 구현할 기능
1. 분야 선택 버튼 (React, JavaScript 등). 검색어 입력창은 없고, 버튼마다 `data-query`에 검색어를 넣어 두었다. 버튼을 누르면 바로 불러온다
2. 영상 카드 목록: 썸네일, 제목, 채널명, 업로드일, 클릭 시 YouTube 새 탭으로 이동
3. 정렬 선택: 관련도순 / 최신순
4. 같은 검색어와 정렬은 `sessionStorage`에 결과를 저장해 재사용 (쿼터 절약)
5. 상태 표시: 로딩 중, 결과 없음, 에러

## 에러 처리 규칙
| 상황 | 처리 |
|---|---|
| 키 미입력 | 요청을 보내지 않고 "config.js에 API 키를 입력해 주세요" 표시 |
| 400 (키 오류) | "API 키가 올바르지 않아요. config.js를 확인해 주세요" 표시 |
| 403 (쿼터 초과 또는 키 제한) | "오늘 사용량을 초과했거나 키 제한 설정에 걸렸어요. Cloud Console을 확인해 주세요" 표시 |
| 결과 0개 | "검색 결과가 없어요" 표시 |
| 네트워크 오류 | "네트워크 연결을 확인해 주세요" 표시 |
| 분야 미선택 | 요청을 보내지 않고 "분야를 골라보세요" 안내 화면 유지 |

- 모든 `fetch`는 `try/catch`로 감싸고, `res.ok`를 확인한 뒤 `res.json()`을 호출한다.
- 에러 메시지에 API 키 값을 절대 출력하지 않는다. `console.log`로 요청 URL 전체를 찍지 않는다 (URL에 키가 포함돼 있음).
- 에러가 나도 화면이 깨지지 않고 이전 결과는 지워진다.

## 코드 규칙
- 변수명, 함수명은 영어 camelCase, 화면에 보이는 문구와 주석은 한국어
- `var` 대신 `const`/`let`, `async/await` 사용
- 함수는 역할별로 나눈다: `buildSearchUrl`, `fetchVideos`, `getCachedResults`, `renderVideoCards`, `formatDate`, `showError`
- 유저 입력과 API 응답 값을 화면에 넣을 때는 `textContent`를 쓴다. `innerHTML`에 그대로 넣지 않는다 (XSS 방지: 악성 스크립트가 화면에서 실행되는 공격).
- 링크는 `target="_blank" rel="noopener noreferrer"`를 붙인다.
- 입력값은 `trim()` 후 사용한다.
- 반응형: 모바일(너비 360px)에서도 가로 스크롤 없이 보여야 한다. 카드는 CSS Grid로 화면 너비에 맞게 열 수가 바뀌게 한다. `<meta name="viewport">`를 넣는다.

## 배포 규칙 (Netlify)
- 이 폴더의 최상위에 `index.html`이 있고, `netlify.toml`의 빌드 명령이 배포 때 `config.js`를 만든다.
- Netlify 사이트 설정 > Environment variables에 `YOUTUBE_API_KEY`를 추가하고 값에 키를 넣는다. 없으면 빌드가 실패한다.
- 환경변수를 바꾼 뒤에는 다시 배포(Trigger deploy)해야 반영된다.
- 폴더/파일 이름의 대소문자를 구분하는 환경이므로 `index.html`, `style.css`, `config.js`, `app.js`는 항상 소문자로 쓰고, HTML에서 연결할 때도 똑같이 쓴다.
- 배포 전 키 제한에 Netlify 주소가 등록돼 있는지 확인한다.

## Git 규칙
- 이 폴더가 Git 저장소의 최상위다. 하위 폴더에 `.git` 폴더를 만들지 않는다 (GitHub에서 폴더가 404로 뜨는 원인이 된다).
- 다른 Git 저장소 폴더 안쪽에 이 폴더를 만들지 않는다.
- `config.js`는 `.gitignore`에 들어 있어 커밋되지 않는다. `git add -f`로 강제로 올리지 않는다.
- 작업 전 `git pull origin main`으로 원격 변경 사항을 먼저 받는다.
- 커밋 메시지는 한국어로 짧게 쓴다 (예: `영상 카드 추가`).
- `git push --force`는 사용자가 명시적으로 요청할 때만 쓴다.

## 작업 방식
- 새 기능은 한 번에 하나씩 추가하고, 추가할 때마다 브라우저에서 동작을 확인한다. 수정한 CSS/JS가 반영이 안 되면 강력 새로고침(Ctrl+F5)을 한다.
- 확인되지 않은 API 동작(응답 필드, 쿼터, 에러 코드 등)은 추측하지 말고 공식 문서나 실제 호출로 확인한다.
- 코드를 설명할 때는 어려운 용어를 초보자도 이해할 수 있게 풀어 쓴다.

## 완료 기준
- [ ] Cloud Console에서 API 키를 발급하고 HTTP 리퍼러 제한과 YouTube Data API v3 제한을 설정했다
- [ ] `config.js`에 키를 넣으면 "react 입문" 검색 결과 카드가 표시된다
- [ ] 키가 비어 있으면 안내 문구가 표시되고 요청이 나가지 않는다
- [ ] 빈 입력, 결과 0개, 네트워크 오류에서 화면이 깨지지 않는다
- [ ] 같은 검색을 반복하면 저장된 결과를 재사용한다
- [ ] 제목의 특수문자가 깨져 보이지 않는다
- [ ] 모바일 화면에서 레이아웃이 깨지지 않는다
- [ ] Netlify 배포 주소에서 정상 동작한다