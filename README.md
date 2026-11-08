# Margin

논문 지도 기록, 수정 작업, 원고 버전과 교수 검토를 이어 보는 연구 공간.

[서비스](https://margin-research.pages.dev) · [개발 시작](docs/development.md) · [작업 규칙](CONTRIBUTING.md) · [변경 내역](CHANGELOG.md)

## 실행

Node.js 22, npm을 사용합니다.

```sh
cd apps/home-preview
npm ci
cp .env.example .env.local
npm run dev
```

`.env.local`에는 관리자가 제공한 Supabase URL과 공개 키를 설정합니다. 비밀번호와 서버 키는 입력하지 않습니다. 실제 계정은 관리자가 별도로 공유합니다.

## 구성

- `apps/home-preview/src`: React 앱과 공통 UI
- `apps/home-preview/public`: 브랜드·글꼴·공개 자산
- `apps/home-preview/supabase`: DB 마이그레이션, 서버 함수, 권한 테스트
- `docs`: 제품·디자인·구조·배포 기준
- `.github`: PR 검사, 배포, 작업 양식

React/Vite/TypeScript · Supabase Auth/DB/Storage/Edge Functions · Cloudflare Pages · Gemini.

## 공동작업

작업 브랜치에서 수정하고 PR을 엽니다. 검사와 동료 검토 후 `main`에 병합합니다. `main`의 검사 통과본만 배포합니다. DB·서버 함수 변경은 관리자가 검토합니다. 자동 배포의 연결 조건은 [배포 안내](docs/deployment.md)를 확인하세요.

[문서 목록](docs/README.md) · [AI 작업 기준](AGENTS.md)
