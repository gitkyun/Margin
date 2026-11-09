# 웹앱 작업

저장소 루트 `AGENTS.md`와 `docs/design/README.md`(Montage 기준)를 따릅니다. 화면 구현은 `src`에 두고 제품 권한·저장·실패 처리를 함께 확인합니다.

빌드는 `dist/client`를 생성합니다. `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, `tests/sites-worker.test.mjs`는 Sites 호환용이므로 유지합니다. 실제 배포는 Cloudflare Pages입니다.

시각 검증은 사용자가 담당합니다. 수행한 코드 검사·HTTP 검사와 실제 브라우저·마이크·AI 검증을 구분하세요.
