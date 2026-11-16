# 웹앱 작업

저장소 루트 `AGENTS.md`와 `docs/design/README.md`(Montage 기준)를 따릅니다. 화면 구현은 `src`에 두고 제품 권한·저장·실패 처리를 함께 확인합니다.

빌드는 `dist/client`를 생성합니다. `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, `tests/sites-worker.test.mjs`는 Sites 호환용이므로 유지합니다. 실제 배포는 Cloudflare Pages입니다.

시각 검증은 사용자가 담당합니다. 수행한 코드 검사·HTTP 검사와 실제 브라우저·마이크·AI 검증을 구분하세요.

## Kokonut 도입

루트 `AGENTS.md`의 **외부 UI 라이브러리 도입 원칙 (2026-11-16 사용자 확정)**을 따른다. 지정한 데모의 실제 원본 코드·기반 부품·구조·간격·정렬·동작을 유지하고, 색·폰트·한글·실제 기능 연결만 바꾼다. Montage로 재구현하거나 기존 CSS로 비슷하게 흉내 내지 않는다. 원본 파일을 넣고 화면에서 쓰지 않는 상태는 완료가 아니다. 이번 요청의 시각 검수는 사용자가 담당하며 모바일 확인은 보류한다.
