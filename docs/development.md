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

`public/pdfjs`는 설치 패키지에서 빌드 전에 생성하며 커밋하지 않습니다. `dist`, 업로드·녹음·실제 연구 자료·캐시·로컬 비밀값도 제외합니다. Sites용 worker와 테스트는 호환용으로 유지하며 실제 운영 배포는 Cloudflare Pages입니다.
