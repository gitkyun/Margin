# 개발

Node.js 22와 npm을 사용합니다. 앱 경로는 `apps/home-preview`입니다.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local`에는 관리자가 제공한 Supabase URL·공개 키를 입력합니다. 별도 DB/Cloudflare 관리 권한은 일반 앱 개발에 필요하지 않습니다. 연결 없이 보이는 로컬 모드는 서버 저장 검증을 대신하지 않습니다.

`src/pages`는 화면, `src/components`는 UI, `src/lib`는 API·상태·권한 연결, `supabase/functions`는 서버 AI·삭제 처리, `supabase/migrations`는 DB 이력입니다. 스타일은 영향 화면과 두 테마를 함께 확인합니다. 전역 토큰 수정은 공통 버튼·필드·편집기·공개 페이지까지 영향을 확인합니다.

검사는 [공동작업 안내](../CONTRIBUTING.md)를 따릅니다. `test:backend`는 PGlite 기반 DB 테스트로 운영 DB를 변경하지 않습니다. `test:live` 및 `supabase/scripts/check-*.mjs`는 운영에 가상 데이터를 만들 수 있으므로 자동 CI에서 실행하지 않습니다.

`npm run test:e2e`는 Playwright로 실제 브라우저 흐름을 봅니다(처음 한 번 `npx playwright install chromium`). 서버 설정 없이 빌드한 미리보기 모드와, 가짜 서버 주소로 빌드하고 응답을 테스트가 정하는 연결 모드 두 가지로 실행하므로 운영 DB와 실제 계정을 쓰지 않습니다. 서버 쪽 권한 규칙은 `test:backend`가 검증합니다.

`public/pdfjs`는 설치 패키지에서 빌드 전에 생성하며 커밋하지 않습니다. `dist`, 업로드·녹음·실제 연구 자료·캐시·로컬 비밀값도 제외합니다. Sites용 worker와 테스트는 호환용으로 유지하며 실제 운영 배포는 Cloudflare Pages입니다.

## 브랜치·PR 정리

- 작업은 `main`이 아니라 목적별 브랜치와 PR로 한다. 브랜치 이름은 `fix/…`, `feat/…`, `docs/…`, `chore/…`.
- PR이 병합되면 GitHub의 브랜치와 로컬 브랜치를 지운다. 이 저장소는 squash 병합이라 `git branch -d`가 "병합 안 됨"이라고 할 수 있다. 지우기 전에 `git cherry origin/main <브랜치>`로 `+`(main에 없는 커밋)가 없는지, 또는 PR이 MERGED인지 확인한다.
- 같은 제목의 PR이 이미 병합됐다면 오래된 중복 PR은 닫고 브랜치도 지운다.
- Dependabot PR이 오래돼(몇 주) 큰 버전 변경을 담고 있으면 닫는다. 필요하면 Dependabot이 최신 상태로 다시 연다.
- 작업 폴더(`git worktree`)는 작업이 끝나면 `git worktree remove`로 치운다. 각 폴더의 `node_modules`가 약 600MB라 쌓이면 용량이 크다. 커밋 안 된 변경이 있는 폴더는 지우기 전에 `git diff`와 추가된 파일을 따로 백업한다.
- 병합되지 않은 로컬 작업은 지우지 말고 `backup/…` 이름으로 GitHub에 올려 둔다(예: `backup/review-action-permissions-20261119`).

