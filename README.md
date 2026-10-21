# Prompt Archive

AI 일러스트 프롬프트를 검색·열람·복사하는 공개형 정적 웹사이트입니다.

## 기능
- 한국어 검색: 제목, 설명, 프롬프트 본문, 모델명, 태그, 분류
- 분류 탭과 분류별 개수
- 최근 등록순 / 이름순 정렬
- 상세 보기와 프롬프트 복사
- 모바일·데스크톱 반응형 화면
- 로그인이나 데이터베이스 없이 동작

## GitHub Pages로 공개하기
1. GitHub에 로그인하고 새 **Public** 저장소를 만듭니다. 예: `prompt-archive`
2. 이 폴더 안의 파일과 `data` 폴더를 저장소 최상위에 업로드합니다. `index.html`이 최상위에 있어야 합니다.
3. 저장소에서 **Settings → Pages**로 이동합니다.
4. Build and deployment에서 `Deploy from a branch`를 선택합니다.
5. Branch는 `main`, 폴더는 `/(root)`를 선택하고 저장합니다.
6. 배포가 끝나면 Pages 화면에 표시되는 주소로 접속합니다.

예상 주소 형식: `https://깃허브아이디.github.io/prompt-archive/`

## 프롬프트 추가하기
`data/prompts.json` 배열에 아래 형식의 객체를 추가합니다.

```json
{
  "id": "prompt-0011",
  "title": "프롬프트 제목",
  "category": "background",
  "tags": ["tag-one", "tag-two"],
  "model": "Illustrious",
  "prompt": "prompt text, ...",
  "negative_prompt": "",
  "description": "짧은 설명",
  "created_at": "2026-10-21"
}
```

- `id`는 각 항목마다 겹치지 않게 지정합니다.
- `category`는 `data/categories.json`의 `id` 중 하나와 일치해야 합니다.
- `prompt`에는 방문자가 복사할 긍정 프롬프트를 입력합니다.
- `negative_prompt`가 비어 있지 않으면 상세 창에 별도 표시됩니다.
- JSON 문법을 지켜야 합니다. 항목 사이 쉼표와 큰따옴표를 확인하세요.

## 분류 추가하기
`data/categories.json`에 객체를 추가합니다. 예:

```json
{ "id": "camera", "name": "카메라·시점" }
```

그다음 원하는 프롬프트의 `category`를 `"camera"`로 지정합니다. `all`은 전체 보기 전용 ID이므로 새 분류 ID로 사용하지 마세요.

## 운영 및 보안 메모
- 이 사이트는 정적 사이트입니다. 방문자는 검색·열람·복사만 가능하며 웹 화면에서 데이터를 수정하거나 업로드할 수 없습니다.
- GitHub 저장소에 올라간 프롬프트 데이터는 공개됩니다. 비밀번호, API 키, 개인정보를 저장하지 마세요.
- 운영자 수정은 GitHub 저장소의 JSON 파일을 편집하고 변경 사항을 커밋하는 방식입니다.
- 프롬프트의 출처와 사용 조건을 확인하고, 삭제 요청을 받을 수 있는 연락 방법과 이용 안내를 사이트에 추가하는 것을 권장합니다.
- 데이터 `fetch()` 방식이므로 HTML 파일을 기기에서 직접 열기보다는 GitHub Pages에 배포한 URL에서 테스트하세요.
- Google Fonts를 불러오도록 설정되어 있어 글꼴 로딩 시 인터넷 연결이 필요합니다.

## 사용자 지정
- 사이트 이름과 설명은 `index.html`에서 수정할 수 있습니다.
- 색상과 레이아웃은 `style.css`의 `:root` 변수와 CSS 규칙에서 수정합니다.
- 검색 및 동작은 `app.js`에서 관리합니다.
