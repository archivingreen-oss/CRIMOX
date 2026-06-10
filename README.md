# 형사소송법 OX 퀴즈 — 아카이브 설정 가이드

## 📂 파일 구성

```
STUDYMAP/  (기존 GitHub 저장소에 추가)
├── index.html                 ← 기존 민법 맵 (그대로)
├── archive.js                 ← NEW · 공유 모듈
├── 3_1__공판심리의범위.html      ← 수정됨
├── 3_2__공판절차.html            ← 수정됨
├── 3_3__특수한_공판절차.html     ← 수정됨
├── 3_4__증거법의기본이론.html    ← 수정됨
├── 3_5__위법수집증거배제법칙.html ← 수정됨
├── 3_6__전문법칙.html            ← 수정됨
├── 3_7__증거동의_탄핵증거.html   ← 수정됨
└── 3_8__증명력.html              ← 수정됨
```

각 HTML 파일은 끝부분에 **단 2줄**만 추가됐어요:
```html
<script>
  window.FILE_ID = '3_1';
  window.FILE_TITLE = '제1장 공판심리의 범위';
</script>
<script type="module" src="./archive.js"></script>
```
나머지 본문(DATA, pick 함수, 스타일)은 원본 그대로 보존.

---

## 🔧 설정 (딱 3단계)

### 1️⃣ Firebase 설정 복사

`archive.js` 상단의 `firebaseConfig` 블록에, **기존 STUDYMAP `index.html` 안의 `firebaseConfig` 값 그대로 붙여넣기.**

```js
// archive.js
const firebaseConfig = {
  apiKey:            "AIzaSy…",        ← 여기 STUDYMAP과 동일
  authDomain:        "xxxxx.firebaseapp.com",
  projectId:         "xxxxx",
  storageBucket:     "xxxxx.appspot.com",
  messagingSenderId: "…",
  appId:             "1:…:web:…"
};
```

기존 STUDYMAP 파일에서 `apiKey` 검색하면 한 번에 찾을 수 있어요.

### 2️⃣ Firestore 보안 규칙 확인

STUDYMAP에서 이미 쓰던 규칙이 사용자 본인의 모든 서브컬렉션을 허용하면 추가 작업 불필요. 만약 컬렉션 한정 규칙이라면 아래 추가:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/quizArchive/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    // 기존 STUDYMAP 컬렉션 규칙도 그대로 두세요
  }
}
```

### 3️⃣ 커밋 & 푸시

```bash
git add archive.js *.html
git commit -m "형소 OX 퀴즈 8개 + 아카이브 모듈 추가"
git push
```

GitHub Pages 빌드되면 끝.  
→ `https://archivingreen-oss.github.io/STUDYMAP/3_1__공판심리의범위.html`

---

## 🎯 사용법

### 화면 요소

| 위치 | 요소 | 역할 |
|---|---|---|
| 우상단 (PC) / 진행률 아래 (모바일) | 작은 회색 알약 | Google 로그인 / 로그아웃 |
| 각 OX 카드 안 | `⚑ 헷갈림` 점선 버튼 | 수동 토글 (정답이어도 표시 가능) |
| 우하단 검은 원형 | 🏷️ + 빨간 숫자 | 아카이브 모달 열기 |

### 자동/수동 동작

- **틀린 문제**: O/X 클릭 → 오답이면 자동으로 빨간 띠 + 아카이브 등록
- **헷갈린 문제**: ⚑ 헷갈림 버튼 클릭 → 토글 (활성화 시 카드에 노란 배경)
- 두 상태는 **공존 가능** (틀렸는데 헷갈리기까지 한 문제)
- 로그아웃 상태에선 localStorage에 저장 → 로그인 시 자동 동기화

### 모아보기 모달

🏷️ 버튼 → 전체 / 오답만 / 헷갈림만 / 이 파일만 필터 가능.  
각 항목에서 `오답 해제` `헷갈림 해제` `완전 삭제` 가능.

---

## 🗃 Firestore 데이터 구조

```
users/{uid}/quizArchive/{file}__q{idx}
  {
    subject:    'criminalProcedure',
    file:       '3_1',
    fileTitle:  '제1장 공판심리의 범위',
    qIdx:       7,
    tag:        '변18',
    q:          '검사가 구두로 공소장변경허가신청을 …',
    a:          'O',
    ex:         '저장매체 전자문서 부분은 …',
    cite:       '2015도3682',
    wrong:      true,
    confused:   false,
    userPick:   'X',
    updatedAt:  <timestamp>
  }
```

추후 민법·민소·헌법 등 다른 과목 OX 퀴즈 만들 때, `subject` 만 바꾸면 같은 컬렉션에서 함께 관리 가능. 모달 필터에 과목별 탭 추가도 쉬움.

---

## ⚠️ 주의

- **Firebase 설정 안 한 채로** 그냥 띄워도 동작은 함 (localStorage만). 상단 바에 `Firebase 미설정 · 로컬 저장만 동작` 표시.
- 다른 브라우저/기기에서 보려면 **Firebase 설정 + 로그인 필수**.
- `localhost` 또는 `archivingreen-oss.github.io` 둘 다 Firebase Authentication의 **승인된 도메인**에 등록돼 있어야 Google 로그인 팝업이 뜸 (STUDYMAP에서 이미 등록돼 있을 것).
