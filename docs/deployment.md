# 배포

`main`에 병합하면 검사 → 필요한 DB/서버 변경 → Cloudflare Pages 순서로 배포합니다. PR에는 배포 권한을 제공하지 않습니다. 실패하면 새 프런트엔드를 배포하지 않습니다. Actions의 **Checks and deployment**에서 결과와 커밋을 확인합니다.

## 관리자 설정

GitHub **Settings → Secrets and variables → Actions**에 설정합니다. 실제 값은 문서·이슈·PR에 붙여 넣지 않습니다.

| 종류 | 이름 | 용도 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | 해당 계정의 Pages Write 전용 토큰 |
| Secret | `SUPABASE_ACCESS_TOKEN` | 관리자의 Supabase CLI 접근 토큰 |
| Secret | `SUPABASE_DB_PASSWORD` | 현재 프로젝트 DB 비밀번호. 서비스 로그인 비밀번호와 다름 |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Pages 계정 |
| Variable | `CLOUDFLARE_PAGES_PROJECT` | `margin-research` |
| Variable | `SUPABASE_PROJECT_ID` | 현재 Supabase 프로젝트 ref |
| Variable | `VITE_SUPABASE_URL` | 브라우저용 API URL |
| Variable | `VITE_SUPABASE_PUBLISHABLE_KEY` | 브라우저용 공개 키 |
| Variable | `BACKEND_BASELINE_COMMIT` | 관리자가 실제 DB·함수 적용을 확인한 40자 커밋 |

초대 메일용 서버 Secrets(Supabase **Edge Functions → Secrets**):

| 이름 | 용도 |
| --- | --- |
| `RESEND_API_KEY` | Resend API 키(Sending access). 없으면 초대는 만들어지지만 메일은 가지 않고, 화면이 초대 링크 복사를 안내합니다 |
| `RESEND_FROM_EMAIL` | 발신 주소. 예: `Margin <invite@인증한-도메인>`. 비워 두면 Resend 시험용 주소(`onboarding@resend.dev`)를 쓰며, 이 주소는 Resend 계정 주인의 이메일로만 보낼 수 있습니다 |
| `APP_URL` | 메일 링크에 넣을 사이트 주소(선택). 비워 두면 초대를 보낸 화면의 주소를 씁니다 |

Resend에서 발신 도메인을 추가하고 안내된 DNS 레코드(SPF·DKIM, 권장 DMARC)를 등록해 Verified가 된 뒤에 `RESEND_FROM_EMAIL`을 그 도메인 주소로 바꿉니다. `pages.dev` 주소는 DNS를 고칠 수 없어 발신 도메인으로 쓸 수 없습니다. 가입 확인·비밀번호 재설정 메일은 별도입니다: Supabase **Authentication → SMTP Settings**에 Resend SMTP(`smtp.resend.com`, 포트 465, 사용자 `resend`, 비밀번호는 API 키)를 넣은 뒤 확인 메일을 다시 켭니다.

Gemini 키와 `ALLOWED_ORIGINS`는 Supabase 서버 Secrets에서 관리합니다. GitHub 빌드나 브라우저에 Gemini 키를 주입하지 않습니다. 일반 배포는 Auth 정책·계정·서버 Secrets를 덮어쓰지 않습니다.

연구 도우미의 모델 목록은 `ai-assist/models.ts`에서 관리합니다. Gemini 4 Carbon·Hydrogen·Argon과 Gemini 3.8 Flash를 허용하며, `GEMINI_MODEL`에 설정한 기존 기본 모델을 목록 맨 앞에 둡니다(미설정 시 `gemini-3.8-flash`). API 키가 없으면 모델 목록은 비어 있습니다. 모델 선택과 답변 깊이는 서버에서도 검증합니다. 목록 변경은 `ai-assist` 함수만 배포하면 기존 화면에 반영됩니다.

Google Cloud 일반 프로젝트는 서버 Secrets에 `GEMINI_PROVIDER=vertex`와 `GEMINI_PROJECT_ID`를 설정합니다. 서비스 계정에 연결된 기존 API 키로 `projects/{project}/locations/global` 경로를 호출합니다. 프로젝트 설정이 없으면 기존 Express 경로를 유지합니다. Express 가입 지역은 전역 호스트를 호출해도 그대로 쓰이므로 카본이 지원되지 않는 지역에서는 404가 발생할 수 있습니다.

### AI 크레딧 운영

- 정책(시범): 개인별 월 20,000크레딧, 1크레딧 = 모델 비용 0.001달러, 매월 1일 UTC(한국시간 오전 9시) 초기화, 월 지급분 이월 없음. 운영 추가 지급분(`rms_ai_credit_grant`)은 따로 남고 달이 바뀌어도 유지됩니다. 구매·결제는 없습니다.
- 단가는 `ai-assist/models.ts`에 있고, 2026년 12월 1일부터 Carbon·Argon, 2027년 1월 1일부터 Flash 3.8 가격이 바뀝니다(공식 Model Garden 가격 페이지 기준, 프로모션 청구 크레딧 반환은 계산에 넣지 않음).
- 서버는 제공사 호출 전에 최대 비용을 예약하고, 실제 사용량을 받으면 출력 해석 전에 정산합니다. 제공사가 거절한 요청만 전액 반환합니다.
- 시간 초과·연결 끊김·사용량 누락처럼 처리 여부를 알 수 없는 요청은 예약이 그대로 남습니다. 사용자에게는 '예약 중' 금액으로 보이고 잔액에서 빠져 있습니다. 운영자는 service role로 `select * from rms_ai_credit_unresolved();`(기본 15분 이상 지난 예약)을 조회해 제공사 청구 내역과 대조합니다. 청구됐으면 `rms_ai_settle_credits(실행 번호, 금액, 사용량, false)`로 확정하고, 처리되지 않은 것이 확실할 때만 `rms_ai_settle_credits(실행 번호, 0, '{}', true)`로 반환합니다. 토큰 수를 추측해 적지 않습니다.
- 확정·반환은 실행마다 한 번만 반영되고, 이후 호출은 `false`를 돌려줍니다. 월 경계를 넘긴 예약은 새 달 잔액을 건드리지 않고 이전 달 몫만 정리됩니다.

## DB와 서버 배포

마이그레이션은 파일명 버전 그대로 적용합니다. 원격에 적용된 SQL을 수정하지 않습니다. 현재 이력에 맞춘 14개 파일은 현재 DB 이력과 맞춘 상태입니다. 이력 충돌이 발생하면 자동 repair/reset하지 않고 중단합니다.

기준 커밋 이후 서버 변경이 있으면 Supabase 접근 토큰·DB 비밀번호가 모두 필요합니다. 연결 전에는 서버 변경 배포가 실패하며, 현재 웹앱은 유지됩니다. 기준 커밋은 배포를 우회하려고 변경하면 안 됩니다. 관리자가 원격 적용 및 검증을 확인한 뒤에만 새 성공 커밋으로 갱신합니다.

`config.toml`의 Auth 값은 로컬 개발 기준입니다. 호스팅 Auth 최소 길이 8자는 콘솔에서 별도로 확인합니다. 호스팅의 공개 가입은 초대 링크 가입을 위해 켜 두며(2026-11-10), 접근은 초대 코드를 쓴 계정만 통과하는 허용 목록이 막습니다. `functions`의 JWT 옵션은 배포에 반영합니다. 네 함수(`ai-assist`, `delete-research`, `project-invite`, `review-notify`) 모두 내부에서 실제 사용자와 접근 권한을 검사합니다.

`config.toml`은 CI가 고정한 Supabase CLI(현재 2.54.11)로 읽을 수 있어야 합니다. 읽지 못하면 `supabase link`에서 서버 배포가 멈추고, 그 뒤의 웹앱 배포도 진행되지 않습니다(2026-11-10 `[auth.email] enabled` 키로 실패). 이 파일을 바꾸면 같은 버전 CLI로 `supabase status --workdir apps/home-preview`를 실행해 `failed to parse config`가 나오지 않는지 확인합니다(Docker 연결 오류는 무관).

## 복구와 확인

프런트엔드는 Cloudflare에서 이전 성공 배포로 되돌릴 수 있습니다. DB는 자동 롤백하지 않으므로 이전 앱과 호환되는 추가 마이그레이션을 우선합니다. 서버 변경 전 관리자가 백업 방법과 영향 데이터를 확인합니다.

자동 검사는 코드·의존성 취약점·DB 격리 테스트·빌드·E2E(실제 서버 없이 미리보기와 가로챈 응답으로 실행)·공개 진입 주소 응답을 확인합니다. 실제 메일 발송과 실제 계정으로 하는 초대 수락은 자동 검사에 없습니다. 실제 사용자 브라우저, 마이크, Gemini 호출, 공동 편집·교수 검토는 별도로 확인합니다. 성공한 빌드만으로 실제 AI 검증 완료라고 기록하지 않습니다.

공식 안내: [Cloudflare CI 업로드](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/), [Supabase 환경 배포](https://supabase.com/docs/guides/deployment/managing-environments).
