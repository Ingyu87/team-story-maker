# 우리들의 이야기 릴레이

초등 협동 글쓰기 수업을 위한 React + Firebase 웹앱입니다. 교사는 프로젝트와 모둠별 이야기방을 만들고, 학생은 공유 링크로 들어와 순서대로 글을 이어 씁니다. Gemini는 서버리스 API를 통해 문장 필터링과 교사용 활동 분석에 사용됩니다.

## 주요 기능

- 교사용 Firebase 이메일 로그인
- 학급/수업 프로젝트 폴더 관리
- 모둠별 이야기방 생성 및 실시간 참여자 모니터링
- 랜덤/지정/자유 글쓰기 순서
- 문장/문단 단위 릴레이 글쓰기
- 학생 입력 로컬 필터 + Gemini 필터링
- 모둠별 동료 평가와 교사 평가
- Gemini 기반 교사용 활동 분석 보고서

## 환경 변수

`.env.local` 또는 배포 환경 변수에 아래 값을 설정합니다.

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_APPCHECK_SITE_KEY=

GEMINI_API_KEY=
```

`GEMINI_API_KEY`는 브라우저 번들에 포함되면 안 됩니다. `VITE_GEMINI_API_KEY`를 쓰지 말고, Vercel 환경 변수에 서버 전용으로 등록하세요.

## 실행

```bash
npm install
npm run dev
```

Vite 개발 서버만 사용할 경우 `/api/gemini` 서버리스 함수가 없어서 Gemini 호출은 실패하고 로컬 필터/시뮬레이션으로 대체됩니다. Gemini까지 로컬에서 확인하려면 Vercel 개발 서버를 사용하세요.

```bash
npx vercel dev
```

## 검증

```bash
npm run lint
npm run build
```

## 배포 전 체크

- Firebase Authentication에서 이메일/비밀번호 로그인을 켭니다.
- Firebase Realtime Database 보안 규칙을 수업 운영 방식에 맞게 잠급니다.
- Firebase App Check에서 Web 앱을 reCAPTCHA v3로 등록하고 `VITE_FIREBASE_APPCHECK_SITE_KEY`를 Vercel 환경 변수로 등록합니다.
- Vercel에 `GEMINI_API_KEY`를 서버 환경 변수로 등록합니다.
- 이전에 브라우저용 `VITE_GEMINI_API_KEY`를 배포한 적이 있다면 해당 Gemini 키를 폐기하고 새 키를 발급하세요.
