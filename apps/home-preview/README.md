# Margin 웹앱

React·TypeScript·Vite 기반 학생 연구 작업 공간과 지정 교수의 검토 화면이다. 소개·로그인·가입 시연·프로필·AI 사용량·연구 설정·라이트·다크, 미팅·피드백·할 일·자료·수정 결과·항목별 검토를 연결한다.

## 수업 시연 배포

주소: https://margin-research.pages.dev (이전 배포본: https://rms-classroom-demo.pages.dev)

학생·교수는 미리 발급한 계정으로 로그인한다. 지정 교수만 검토를 열 수 있으며 학생의 비공개 메모와 전체 작업은 공유하지 않는다. AI 키는 사용자 요청으로 비워 두었으며 직접 정리·수정 방안 작성·할 일·교수 검토는 사용할 수 있다. 새 응답은 창으로 돌아오거나 화면을 보고 있는 동안 약 30초 간격으로 확인한다.

## 실행

Node.js 22 이상과 npm을 사용한다. 앱 폴더에서 실행한다.

```bash
npm ci
npm run dev -- --port 4175
npm run build
npm run preview -- --port 4175
```

`.env.local`이 없으면 **로컬 미리보기**로 실행한다. 가상 학생과 자료를 IndexedDB에 저장하며 실제 로그인·교수 권한·AI 응답을 가장하지 않는다. 미리보기의 교수 응답은 표시용 가상 기록이며 학생 계정으로 새 교수 응답을 작성할 수 없다. AI는 연결 오류를 안내하고 직접 작성을 유지한다.

실제 연결은 `.env.example`의 두 공개 값을 `.env.local`에 설정하고 [Supabase 준비](supabase/README.md)를 따른다. Gemini·관리 키·계정 비밀번호는 VITE 변수에 넣지 않는다. 서버 연결 실패 시 미리보기로 조용히 전환하지 않는다.

## 검사

```bash
npm run typecheck
npm test
npm run test:backend
npm run test:sites
npm run build
```

DB 검사는 PGlite PostgreSQL의 RLS·함수·상태 규칙을 실행한다. 클라우드 로그인·바이너리 전송·실제 Gemini 호출·배포 주소에서의 사용자 동작은 별도 확인해야 한다. 현재 기록은 [design-qa.md](design-qa.md)를 참고한다.

## 구조

- `src/RmsApp.tsx`: 인증·경로·공통 탐색과 알림.
- `src/pages/student`: 미팅·피드백·할 일·자료·수정 결과·AI 보조.
- `src/pages/reviews`: 요청 생성·공유 미리보기·항목별 검토·재확인.
- `src/lib/repository.ts`: 실제 Supabase와 명시적 IndexedDB 미리보기.
- `supabase/migrations`: 테이블·권한·서버 저장 동작.
- `supabase/functions/ai-assist`: 인증된 실제 Gemini 호출.
- `public`: 자체 호스팅 글꼴·가상 PDF·Pages 경로와 헤더.

## Cloudflare Pages

Git 저장소 루트는 `apps/home-preview`, 빌드 명령은 `npm run build`, 결과 경로는 `dist/client`다. Node 22를 지정한다. VITE 공개 변수 두 개를 설정한 뒤 배포한다. `_redirects`가 직접 주소 진입을 처리한다. Pages의 주소는 Supabase Edge의 `ALLOWED_ORIGINS`에 정확히 추가한다.

`build:sites`와 `worker/`는 기존 Sites 전달용 보존 경로다. 이번 배포 대상은 Cloudflare Pages이며 두 배포 방식을 혼용하지 않는다.

## 현재 작업 위치

교수님 수업 폴더의 `Margin/`이 현재 로컬 작업 공간이다. `archive/previous-chat/`는 이전 조사·문서·작업 원본을 보관한 이력이며 현재 실행 소스와 구분한다. 비공개 설정·계정·실제 자료는 전달 소스에서 제외한다.

PDF 등록 범위는 대표 시연 계획에 따라 20MB 이하의 PDF다. PNG·JPEG 등 추가 형식은 기획 기준안과 구분해 아직 구현하지 않았다. 로드맵·캘린더·녹음 코드는 추가했다. 전사와 전체 본문 검색은 연결하지 않았다.

## 2026-11-04 당시 구현 기록

첫 진입은 소개 화면이며, `/signup`은 계정을 발급하지 않는 시연이다. `/account`는 프로필·테마·실제 서버 요청 집계, `/r/:id/settings`는 연구 정보와 보관·복원, `/r/:id/assistant`는 선택한 기록 한 개로 질문하는 AI 화면이다. 이 당시 대화는 현재 탭에만 임시 보관했다. 현재 대화는 서버의 개인 기록으로 저장한다. 키가 없으면 질문을 유지하고 연결 전 안내를 표시한다. 실제 생성이나 잔액을 가장하지 않는다.

페이지·상태·참고자료 선택 근거: [경험 개편](../../docs/design/experience-revision-20261104.md). 검증 결과: [2026-11-04](../../docs/development/verification-20261104.md).

## 2026-11-05 경험 확장

글쓰기·문서 버전 비교·한글 PDF, 자료 폴더, 공동연구 권한, 계획/다이어그램/캘린더/시간 조율, 실제 마이크 녹음 코드, 개인 AI 대화·다섯 작업·오버뷰·집계를 추가했다. 구현·클라우드 검사·미완료 화면 검증은 [최신 검증 기록](../../docs/development/verification-20261105.md)에 구분했다. [화면·라이브러리 적용표](../../docs/design/implementation-map-20261105.md)를 함께 읽는다.

## 2026-11-06 ~ 2026-11-07 Margin 리브랜딩 및 배포

Margin 브랜드(심벌·워드마크·마스코트 16종)와 연구 도우미 캐릭터를 반영하고 신규 주소 `https://margin-research.pages.dev`로 배포를 완료했다. 세부 내역은 [Margin 브랜드 기록](../../docs/design/margin-brand-20261106.md)과 [검증 기록](../../docs/development/verification-20261106.md)을 참조한다.
