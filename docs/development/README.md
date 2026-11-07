# 개발 안내

## 현재 구현

실행 앱은 [apps/home-preview](../../apps/home-preview/README.md)에 있다. 기존 폴더명은 초기 미리보기에서 유지했지만 현재는 여러 페이지와 실제 Supabase 연결 코드를 포함한다. 제품 문서의 전체 기능이 구현됐다는 뜻은 아니다. 첫 배포 목표는 [D01~D06](classroom-demo.md)이다.

| 역할 | 구성 |
|---|---|
| 웹앱 | React 19 · TypeScript · Vite · React Router · TanStack Query |
| UI | Margin 자체 화면 · Radix · Motion · Pretendard · Disarto, 기존 공통 래퍼 보존 |
| 저장·로그인·파일 | Supabase PostgreSQL · Auth · private Storage |
| AI | Supabase Edge Function → Gemini, 서버 키만 사용 |
| 배포 | Cloudflare Pages 정적 앱, SPA 직접 경로 지원 |

학생·교수는 사전 발급 계정과 허용 목록을 사용한다. 공개 회원가입·교수 다수 학생 대시보드는 제외한다. 실 API 입력은 가상 자료만 사용한다.

## 실행·검사

```bash
cd apps/home-preview
npm ci
npm run dev -- --port 4175
npm run typecheck
npm test
npm run test:backend
npm run test:sites
npm run build
```

저장소 루트에서는 `python3 scripts/check_repository.py`와 `git diff --check`를 실행한다. 문서 검사와 제품 동작 검사는 구분한다.

## 서버 연결과 배포

[Supabase 연결 안내](../../apps/home-preview/supabase/README.md), [앱 환경 변수](../../apps/home-preview/.env.example), [디자인 기준](../../apps/home-preview/DESIGN.md), [검증 기록](../../apps/home-preview/design-qa.md)을 따른다. 환경 변수와 실제 계정 비밀번호·연구 자료를 Git에 넣지 않는다.

Cloudflare Pages의 프로젝트 루트는 `apps/home-preview`, 빌드는 `npm run build`, 출력은 `dist/client`다. 배포 주소(`https://margin-research.pages.dev`)를 Edge의 허용 출처에 추가한다. 라이트·다크와 로그인 후 직접 검토 링크 복귀를 같은 배포 주소에서 확인한다.

## 완료 판정

코드 작성, 격리 테스트 통과, 실제 클라우드 연결, 배포 시연을 각각 기록한다. 코드만 있는 기능을 시연 완료로 쓰지 않는다. 소개 페이지와 제목 찾기는 구현했다. 로드맵·캘린더·녹음 코드는 추가했고 전사·전체 본문 검색은 미연결이다. 실제 확인 범위는 [2026-11-06 기록](verification-20261106.md)을 따른다. 변경 이력·작업 완료·교수 결과·읽음은 별도 상태다.

## 2026-11-06 ~ 2026-11-07 Margin 리브랜딩 및 GitHub 동기화

Margin 브랜드 및 연구 도우미 캐릭터를 반영하고 새 주소(`https://margin-research.pages.dev`)로 배포했다. 사용자 요청에 따라 GitHub 원격 저장소(`gitkyun/Margin`)의 최신 상태를 확인하고 저장소 및 스튜디오 폴더의 문서를 Margin으로 통일 반영하여 원격에 동기화한다.
