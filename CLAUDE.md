# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

제품 조건·작업 원칙은 아래 AGENTS.md를 그대로 따른다. 이 파일은 그 위에 실행 명령과 코드 구조만 더한다.

@AGENTS.md

## 폴더 구분

- `apps/home-preview/`: 유일한 실행 앱(패키지명 `margin-web`). 이름은 초기 미리보기에서 남았을 뿐 현재 실제 Supabase 연결 앱이다. 앱 전용 지침은 `apps/home-preview/AGENTS.md`, 시각 기준은 `apps/home-preview/DESIGN.md`.
- `docs/product/`: PRD·기능명세서·유저플로우·IA. 요구사항 판단의 기준.
- `archive/previous-chat/`: 이전 조사·문서 작업 이력. 현재 소스가 아니며 수정하지 않는다.
- `.local/`, `supabase/*.local*`, `.env.local`: 배포 업로드 토큰·계정·키가 들어 있는 비공개 파일. 열어 출력하거나 다른 위치로 복사하지 않는다.
- 상위 폴더(`../`)는 수업 자료(주차별 PDF, 참고 스크린샷 `IMG_*`, `wanted.md` 원본)다. `wanted.md`는 수정하지 않는다.
- 이 작업 폴더에는 `.git`이 없을 수 있다(GitHub 로컬 허브에 공유 소스만 따로 복사). `git` 명령이 실패하면 그 사실을 알리고 파일 비교로 대신한다.

## 명령

앱 명령은 `apps/home-preview`에서 실행한다. Node 22 이상.

```bash
npm ci
npm run dev -- --port 4175     # predev가 pdfjs 자산을 public/pdfjs로 복사
npm run typecheck
npm test                       # Vitest: src/**, tests/**, supabase/functions/** 의 *.test.ts
npm run test:backend           # PGlite로 마이그레이션·RLS·RPC 실행
npm run test:sites             # Sites 보존 경로 검사
npm run build                  # tsc --noEmit 후 vite build → dist/client
npm run format:check
```

단일 테스트:

```bash
npx vitest run src/lib/notifications.test.ts
npx vitest run -t "테스트 이름 일부"
node --test --test-name-pattern "recheck" supabase/tests/backend.test.mjs
```

저장소 루트 검사: `python3 scripts/check_repository.py` (문서 링크·필수 파일만 확인).

실제 클라우드 검사는 가상 기록을 실제 프로젝트에 추가하므로 사용자 요청이 있을 때만 실행한다: `node --env-file=supabase/.env.provision.local supabase/scripts/check-live.mjs --apply`(`--apply` 없으면 실행 안 함), Edge 검사는 `supabase/scripts/check-edge.mjs`.

## 구조

**두 실행 모드.** `src/lib/supabase.ts`는 `VITE_SUPABASE_URL`·`VITE_SUPABASE_PUBLISHABLE_KEY`가 있을 때만 클라이언트를 만든다. 없으면 `preview` 모드로 `src/lib/demo.ts`의 가상 자료를 IndexedDB(`rms-preview-v1`)에 저장한다. 연결 실패 시 미리보기로 전환하거나 가짜 성공·가짜 AI 응답을 만들지 않는다.

**데이터 접근은 한 곳.** 화면은 `useWorkspace()`(`src/lib/workspace.tsx`, 계약은 `workspace-contract.ts`)만 사용한다. 각 메서드가 `mode`에 따라 Supabase RPC 또는 IndexedDB(`src/lib/repository.ts`)로 분기한다. 새 데이터 동작은 계약 → 두 모드 구현 → RPC 순으로 같이 추가한다. 연결 모드는 TanStack Query로 30초마다 다시 불러온다.

**도메인 모델.** `src/lib/domain.ts`의 `EntityMap`/`EntityKind`가 학생 기록 종류(미팅·피드백·작업·질문·자료·버전·수정 결과 등)다. DB에서는 연구별 `rms_records` 한 테이블에 kind로 구분해 저장하고, 교수 검토는 `rms_review_requests → items → rounds → responses/comments` 별도 테이블에 당시 스냅샷으로 저장한다.

**쓰기는 RPC로만.** 테이블 직접 쓰기는 RLS로 막혀 있고 `rms_bootstrap`, `rms_save_record`, `rms_create_review`, `rms_recheck`, `rms_respond` 등 함수로만 바꾼다(계약 전체는 `apps/home-preview/supabase/README.md`). 지켜야 할 규칙:
- 갱신 시 이전에 받은 `updatedAt`을 그대로 보낸다. 충돌하면 SQLSTATE `40001`이며 입력을 유지한 채 안내한다.
- 검토 생성·재확인은 `requestKey`(UUID)로 멱등 처리한다. 재시도는 같은 키, 내용이 바뀌면 새 키.
- 교수 권한은 서버가 지정 이메일·공유 상태로 판정한다. React의 역할 값은 권한이 아니다.

**마이그레이션.** `supabase/migrations/`는 순서대로 쌓이며 뒤 파일이 `create or replace`로 함수를 덮어쓴다(예: `rms_save_record`의 실제 정의는 가장 최신 파일). 동작을 바꿀 때 기존 파일을 고치지 말고 새 마이그레이션을 추가하고 `supabase/tests/backend.test.mjs`에 검사를 더한다. 이 테스트의 Auth·Storage는 대체물이므로 통과가 클라우드 적용을 뜻하지 않는다.

**AI.** `supabase/functions/ai-assist/`(Deno Edge Function)가 Gemini를 호출한다. 함수가 직접 Bearer 토큰·허용 계정·연구 소유권을 확인하고, 실행 제한(분당 6회·일 100회·중복 차단)과 발췌 위치 검증(`validation.ts`)을 한다. 키는 Supabase secrets에만 둔다. `VITE_*`에 서버 비밀을 넣지 않는다.

**화면.** 경로는 `src/RmsApp.tsx`: 학생은 `/r/:researchId/{meetings,feedback,tasks,materials,results,reviews}`, 교수는 `/reviews/:requestId`. 학생 화면은 `src/pages/student/`, 검토는 `src/pages/reviews/`. 새 화면은 RMS 자체 CSS와 기존 Radix 동작을 사용한다. `src/experience.css`가 새 시각 규칙, `src/styles.css`와 영역별 CSS는 기존 기반이다. `src/components/ui/`의 버튼·입력·textarea는 자체 스타일이며 다른 기존 래퍼는 남아 있다. 소개는 `/`, 계정은 `/account`, 연구 설정과 도우미는 `/r/:researchId/{settings,assistant}`다. PDF는 `PdfViewer.tsx`에서 pdfjs를 지연 로드한다.

**배포.** Cloudflare Pages(루트 `apps/home-preview`, 출력 `dist/client`, 주소 https://margin-research.pages.dev, 이전 배포: https://rms-classroom-demo.pages.dev). `public/_headers`의 CSP가 `connect-src`를 self와 `*.supabase.co`로 제한하므로 새 외부 호출을 추가하면 CSP도 고친다. 배포 주소는 Edge의 `ALLOWED_ORIGINS`에 있어야 한다. `worker/`, `.openai/hosting.json`, `scripts/prepare-sites-build.mjs`, `tests/sites-worker.test.mjs`는 Sites 전달용으로 유지한다.

## 결과 보고

코드 작성, 격리 테스트 통과, 실제 Supabase 확인, 배포 주소의 브라우저 확인을 각각 따로 보고한다. 상태가 바뀌면 `apps/home-preview/design-qa.md`와 `docs/development/` 기록을 함께 갱신한다.
