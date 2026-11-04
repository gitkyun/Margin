# RMS Supabase backend

학생의 개인 기록과 지정 교수에게 공개한 검토를 분리한다. 소유 학생의 기록은 `rms_researches`·`rms_records`에 독립 행으로 저장하고, 공개한 항목·차수·응답·댓글은 별도 테이블에 저장한다. React의 역할 선택값은 접근 권한으로 사용하지 않는다.

## 연결 준비

새 Supabase 시연 프로젝트를 사용한다. 기존 프로젝트에 적용할 경우 기존 정책·테이블과 겹치지 않는지 먼저 확인한다. 아래 SQL은 아직 클라우드에 자동 적용된 상태를 뜻하지 않는다.

1. Supabase CLI에 사용자 본인이 로그인한다. 비밀번호·접근 토큰·service-role key는 채팅이나 저장소에 남기지 않는다.
2. 프로젝트를 연결하고 마이그레이션을 적용한다.

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

DB 비밀번호가 필요하면 사용자 본인이 입력하거나 로컬 비공개 환경에서 설정한다. 명령줄 인자에 실제 비밀번호를 기록하지 않는다. `supabase/config.toml`은 로컬 Auth의 공개 가입을 비활성화한다. 호스팅 프로젝트의 **Authentication → Sign In / Providers → Allow new users to sign up**도 별도로 꺼야 한다.

3. 학생·교수 계정을 미리 발급하고 허용 목록에 등록한다. 관리 콘솔에서 생성한 확인 완료 계정의 UUID를 `rms_demo_accounts.user_id`에 추가할 수도 있다. 자동 준비를 원하면 `.env.provision.example`을 Git에서 제외되는 `.env.provision.local`로 복사해 로컬에서만 값을 넣는다.

```bash
node --env-file=supabase/.env.provision.local supabase/scripts/provision-demo.mjs
node --env-file=supabase/.env.provision.local supabase/scripts/provision-demo.mjs --apply
```

스크립트는 기존 계정의 비밀번호를 바꾸지 않는다. 실제로 생성·등록하는 두 번째 실행 뒤 브라우저에서 로그인해야 확인이 끝난다. 계정은 학생과 교수에 서로 다른 이메일을 사용하고, 비밀번호는 12자 이상으로 설정한다.

4. `.env.functions.example`을 `.env.functions.local`로 복사해 Gemini 키, 모델, 허용 웹앱 주소를 넣는다. 다음 명령은 파일 값을 Supabase의 서버 비밀 설정에 저장한다.

```bash
npx supabase secrets set --env-file supabase/.env.functions.local
npx supabase functions deploy ai-assist
```

`SUPABASE_URL`·`SUPABASE_ANON_KEY`·`SUPABASE_SERVICE_ROLE_KEY`는 Edge 환경이 제공한다. service-role key를 프런트엔드에 넣지 않는다. 프런트엔드에는 Supabase URL과 publishable/anon key만 제공한다. `ALLOWED_ORIGINS`는 로컬 주소와 실제 Cloudflare 배포 주소를 정확히 지정한다. 임의의 전체 와일드카드는 사용하지 않는다.

## RPC 계약

- `rms_bootstrap()` → `WorkspaceData`. 학생은 자신의 연구 기록, 교수는 공유 중인 지정 요청의 스냅샷·파일 메타데이터·대화만 받는다.
- `rms_save_research(p_value)`·`rms_save_record(p_kind,p_value)` → 서버 저장 값. 업데이트 시 **이전에 저장된 `updatedAt`을 그대로 보내야 한다**. 서버가 시각을 변경한다. 다른 창의 변경과 충돌하면 SQLSTATE `40001`로 거부하고 입력을 유지한다.
- `rms_save_preparation(p_meeting,p_questions)` → 저장한 Meeting. 질문 저장과 연결을 한 트랜잭션으로 처리한다. 질문을 준비 목록에서 빼도 질문 원본은 삭제하지 않는다.
- `rms_delete_record(p_kind,p_id)` → 연결·검토 이력에 쓰지 않는 기록만 삭제한다.
- `rms_create_review(p_input)` → ReviewRequest. 입력은 `{researchId,title,professorEmail,resultIds,requestKey?}`. 교수 이메일은 확인 완료된 허용 계정과 일치해야 한다.
- `rms_recheck(p_input)` → 새 ReviewRound. 입력은 `{requestId,itemId,resultId,requestKey?}`. 같은 요청의 같은 항목에 새 차수를 추가한다.
- 생성·재확인 폼의 `requestKey`는 UUID다. 응답을 못 받아 같은 작업을 재시도할 때 같은 키를 재사용한다. 내용이 바뀌면 새 키를 만든다. 같은 키·내용은 같은 결과를 반환하고 같은 키를 다른 내용에 재사용하면 거부한다.
- `rms_respond(p_input)` → ReviewResponse. 입력은 `{roundId,result,comment}`. `changes_requested`에는 이유가 필요하다. 현재 지정된 교수만 최신 차수에 응답한다. 이전 응답은 변경 이력으로 보존한다.
- `rms_response_history(p_round_id)` → 이전 ReviewResponse 배열. 작성자·시각을 보존한다. 교수 계정 변경 뒤 새 교수가 응답하면 새 작성자로 기록한다.
- `rms_comment(p_input)`·`rms_resolve_comment(p_id,p_resolved)` → 댓글 작성·해결. 다른 차수의 댓글에 답글을 달 수 없다.
- `rms_set_sharing(p_input)` → ReviewRequest. `{requestId,status,professorEmail?}`. 학생 소유자만 수행한다.
- `rms_mark_read(p_round_id)` → 현재 계정의 읽음만 저장한다. 교수 결과·학생 처리·작업 완료·대화 해결을 바꾸지 않는다.

## 파일

비공개 버킷은 `research-files`다. 업로드 경로는 `사용자UUID/연구UUID/버전UUID.pdf`, 최대 20MiB, MIME은 `application/pdf`다. 업로드를 완료한 뒤 `versions` 기록을 저장한다. 서버는 Storage의 실제 크기·MIME 메타데이터와 경로를 검사한다. 버전 기록은 갱신할 수 없으며 Storage 객체의 덮어쓰기도 허용하지 않는다.

학생은 소유 파일을 읽고 교수는 현재 공유된 차수에 첨부된 파일만 읽는다. 인증된 다운로드를 사용하며 공개 URL을 만들지 않는다. 공유를 중지하면 이후 읽기는 거부하지만 이미 내려받은 파일을 회수한다고 약속하지 않는다. 기록 연결이 실패한 업로드는 삭제하거나 같은 객체로 연결을 재시도할 수 있다.

## AI

`ai-assist`는 POST `AIInput`을 받고 `AIResult`를 반환한다. `organize_meeting`은 저장된 `memo`·`memoRevision`, `suggest_revisions`는 저장된 `feedback.body`와 요청의 원문을 비교한다. 임의의 다른 연구·변경된 원문은 처리하지 않는다.

`verify_jwt=false`는 Supabase 게이트웨이의 구형 키 검증을 사용하지 않는 설정이다. **함수 자체는 모든 실행에서 Auth `/user`로 Bearer 토큰을 검증하며, 확인된 허용 계정과 연구 소유권도 검사한다.** service key나 클라이언트 역할 값만으로 실행할 수 없다.

Gemini에는 가상 자료만 보낸다. 90초 시간 제한, 계정당 분당 6회·24시간 100회, 같은 입력의 실행 중 중복 차단을 둔다. 이는 서비스 자체의 시연 상한이며 Google 프로젝트의 실제 무료 한도와 별개다. 무료 한도 소진 시 유료 모델로 자동 전환하지 않는다. 중단·한도·실패 시 AI 결과를 실제 저장 완료로 표시하지 않는다. 서버는 발췌의 실제 존재와 위치를 다시 검사하지만 제안 내용의 학술적 정확성을 보장하지 않는다.

오류는 `{error:{code,message}}` 형태다. 대표 코드는 `UNAUTHENTICATED`, `FORBIDDEN`, `SOURCE_CHANGED`, `RATE_LIMITED`, `ALREADY_RUNNING`, `TIMEOUT`, `CANCELLED`, `UNVERIFIED_QUOTE`, `INVALID_OUTPUT`, `MODEL_UNAVAILABLE`, `NOT_CONFIGURED`다. 자동으로 무한 재시도하지 않는다.

## 검증

```bash
node --test supabase/tests/backend.test.mjs
npx vitest run supabase/functions/ai-assist/validation.test.ts
```

DB 테스트는 PGlite의 실제 PostgreSQL·RLS·PL/pgSQL로 마이그레이션과 RPC를 실행한다. Auth·Storage의 테이블/역할은 격리된 테스트 대체물이다. 이 검사는 호스팅 Supabase Auth 로그인·Storage 바이너리 전송·실제 Gemini 호출·Cloudflare 배포가 완료되었다는 의미가 아니다. 그 항목은 실제 배포 주소에서 별도로 확인해야 한다.
