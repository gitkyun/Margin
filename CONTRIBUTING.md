# 공동작업

## 브랜치와 PR

- `main`: 배포 기준. 직접 push하지 않습니다.
- `feat/기능`, `fix/문제`, `chore/정리`: 목적 하나에 브랜치 하나.
- 작업 전 최신 main을 받고, 완료 후 PR을 엽니다. 검사 통과와 다른 한 명의 검토를 확인하고 squash merge합니다.
- 병합한 브랜치는 삭제합니다. 장기 develop 브랜치는 두지 않습니다.

현재 GitHub 요금제는 비공개 저장소의 보호 브랜치를 지원하지 않습니다. PR·동료 검토는 팀 규칙이며 서버에서 강제되는 것으로 오해하지 마세요. 업그레이드는 관리자가 결정합니다.

## 역할

`gitkyun`: 저장소·Supabase·Cloudflare 관리. `hyouka0508`, `dydtjr54`: 앱 개발·동료 검토. GitHub는 각자 계정을 사용합니다. 서비스 체험용 학생·교수 계정은 별개이며 관리자가 비공개로 전달합니다.

## 변경 기록

매 작업에 `CHANGELOG.md` Unreleased를 갱신합니다. PR에는 문제/변경 이유, 영향 화면·권한·데이터, 실제 검사, 남은 제한을 적습니다. 빌드 산출물·개인 보고서·스크린샷을 무조건 추가하지 않습니다.

## 검사

```sh
python3 scripts/check_repository.py
cd apps/home-preview
npm run typecheck
npm test
npm run test:backend
npm run test:sites
npm run build
```

DB는 기존 마이그레이션을 수정하지 않고 새 파일을 추가합니다. 데이터 삭제·계정 조작은 테스트 프로젝트에서만 명시적으로 실행합니다. 운영 계정 변경과 비밀값은 PR/이슈/로그에 남기지 않습니다.
