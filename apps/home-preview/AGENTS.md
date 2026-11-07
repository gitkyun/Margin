# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## 2026-11-04 사용자 피드백

- 첫 진입은 공개 소개 화면. 헤더·푸터·로그인·가입 흐름을 연결한다.
- 가입은 시연 흐름만 제공하고 실제 가입·메일 발송은 열지 않는다.
- 플로팅 사이드바는 첨부 Disarto 참고의 접힘·펼침·현재 위치를 기준으로 한다. 모든 연구/연구 전환/새 연구를 분리한다.
- 새 화면은 자체 스타일·Motion·Radix를 사용한다. 글라스·도트·움직임은 탐색과 소개에 절제해서 사용한다. 긴 기록의 가독성을 우선한다.
- AI 사용량에 가짜 크레딧을 만들지 않는다. 대화는 선택 원문을 확인한 뒤 실행하고 키 미연결을 가짜 답변으로 숨기지 않는다.

## 시각 참고 이미지 (2026-11-04)
- 수업 폴더의 `IMG_1812`~`IMG_1859`가 화면 밀도·구성의 기준이다. 회색 캔버스 위 평평한 사이드바와 흰 본문 패널, 34px 탐색 항목, 한 줄 지표 묶음, 점 상태 배지, 묶음 설정 행, 알약형 하단 도크를 따른다.
- 외형 규칙은 `src/reference.css`에 모은다. 참고 서비스의 브랜드·문구·기능은 가져오지 않는다.

## 승인한 경험 확장 (2026-11-04)
- 로그인 후 LiquidGlass 제거, 소개 헤더에 제한. 테마 선택은 계정 설정 한 곳.
- 공동연구 소유자·편집자 권한. 개인 메모·대화·미채택 AI 후보 비공개. 공동 편집자는 교수 검토 공개·재확인 가능.
- 문서는 저장 단위 공동 편집과 충돌 비교. 원고 버전과 검토 PDF를 보존.
- 연구 휴지통·복원, 자동 영구 삭제 없음. 복원 후 교수 공유 자동 재개 금지.
- 후보 시간 조율·미팅 확정, 동의 후 실제 마이크 녹음·재생·저장. 자동 전사 미연결.
- AI는 사용자가 실행·채택. 실제 허용 Gemini 모델·생각 수준, 가짜 이력·점수·비용 금지.

## 2026-11-05 Compass 참고

- 사용자가 Compass 구성도 선택적으로 활용하도록 요청했다. 전체 프레임워크 교체를 뜻하지 않는다. 현재 반영과 소스 이용 구분은 `../../docs/design/compass-adoption-20261105.md`를 따른다. 신규 컴포넌트는 기존 저장·권한·키보드 동작을 보존한다.

## 2026-11-05 실시간 한국어 전사 확정

- 사용자는 녹음 후 별도 전사가 아니라 녹음 중 한국어 글자 표시와 저장을 요청했다. Web Speech API로 인식하고 Gemini 키는 계속 비워 둔다.
- 중간·확정 문장을 구분하며 원 인식 구간과 수정문을 따로 보존한다. 음성 공유가 비공개 전사문 공개로 이어지지 않는다.
- 인식 서비스의 브라우저 지원·서버 전송·네트워크 한계를 안내하고 실제 마이크 검증과 모의 이벤트 검사를 구분한다.

## 2026-11-06 사용자 시각 수정

- 소개 페이지에서도 LiquidGlass와 기존 회전 도트 궤도를 제거한다. 상단은 실제 Aceternity Cloud Shader를 사용하되 푸른 하늘·해 번짐 없음으로 조절한다.
- 구름 미리보기와 ‘연구의 어느 순간에도’ 탭은 내용을 바꿔도 외곽 높이가 변하지 않게 한다.
- 푸터 위 연구 시작 영역은 선명한 파랑·하늘색 그라데이션으로 강조한다. 푸터 배경도 블루톤을 유지하고 위로 번지는 범위를 넓힌다. 카드 그림자와 하단 여백을 확보한다.
- 푸터 도트는 느린 파동과 포인터 반응을 제공한다. 화면 밖·비활성 탭에서는 정지하고 동작 감소 설정에서는 정적으로 표시한다.
- 공개 소개 푸터에는 라이트·다크·시스템 선택을 제공한다. 로그인 후 테마 설정은 기존 계정 설정 한 곳을 유지한다. 맨 위로 이동은 실제 문서 스크롤 루트를 대상으로 한다.
- 소개의 제품 미리보기는 세로를 넉넉히 확보하되 탭 변경으로 높이가 달라지지 않게 한다. 제목에는 읽기를 방해하지 않는 등장·호버 텍스트 효과를 사용한다.
- 사용자가 최종 시각 검증을 직접 맡는다. 별도 요청 전에는 브라우저 검증을 반복하지 않고 코드 검사·빌드·배포 확인을 구분해 보고한다.
- 푸터 배경은 위로 번지는 정도를 유지하면서 경계의 파란 가로선이 보이지 않도록 단일 확장 배경으로 그린다. 푸터 자체에 별도 불투명 배경을 겹쳐 단차를 만들지 않는다.
- Free ₩0, Pro·Team 출시 예정, 월간·연간 비교. 실제 결제·임의 가격·계정 권한 변경 금지.
- 공동 기록 선택은 다른 활성 참여자가 있을 때 제공한다. 교수 검토 접근과 별도이며 이미 저장한 공동 기록은 자동 비공개 변환하지 않는다.

## 공개 탐색 마감 (2026-11-06)

- 소개의 주요 기능·도움말은 Radix 메뉴로, `/features`·`/pricing`·`/guide`·`/privacy`는 실제 공개 페이지로 연결한다. 내용 없는 메뉴는 늘리지 않는다.
- 가운데 비교 화살표가 직접 드래그되는 단일 조작부이며 범위는 0~100%다. 별도 하단 슬라이더를 다시 넣지 않는다.
- 소개의 장식 표면과 푸터는 하늘색·파란색 계열을 유지한다. 푸터 바깥 도트·그라데이션은 선명하게, 안쪽 링크 판은 불투명하게 유지한다.

- 최신 사용자 지시: 로고·파비콘·브랜드명·AI 캐릭터를 받을 때까지 배포를 보류한다. 현재 수정은 로컬에서 마무리하며 기존 공개 배포를 최신 수정본으로 보고하지 않는다.

## Margin 브랜드 반영 (2026-11-06)

- 사용자 제공 로고·파비콘·캐릭터를 반영해 서비스의 노출 이름은 Margin이다. AI의 역할명은 연구 도우미이며 별도 캐릭터 이름은 미정이다.
- 브랜드 공통 구성은 `src/components/brand/Brand.tsx`(앱 기준), 적용 기록은 `docs/design/margin-brand-20261106.md`(저장소 기준)를 따른다. 원본 자산·기존 RMS 저장 키·서버/호스팅 식별자를 일괄 변경하지 않는다.
- 모델·검토 깊이는 서버의 기능 목록에 있는 선택지만 제공하고 실제 요청에 전달한다. 캐릭터의 완료와 교수 확인을 혼동하지 않는다.
- 이번 자산 반영 후에도 배포는 사용자의 재개 요청 전까지 보류한다. GitHub 공용 허브는 수정·푸시하지 않는다. 사용자 시각 검증 방침을 유지한다.

## Margin 배포 재개 (2026-11-06)

- 사용자가 “배포까지 끝내”로 기존 배포 보류를 해제했다. Margin 최신본을 기존 Cloudflare Pages에 배포했다. GitHub 수정·푸시 금지와 사용자 시각 검증 방침은 유지한다.

## 연구 홈과 새 배포 주소 (2026-11-06)

- 사용자가 `margin.pages.dev` 사용 불가 뒤 `margin-research.pages.dev`를 선택했다. 새 주소로 배포하며 기존 RMS 주소는 보존한다. GitHub는 수정·푸시하지 않는다.
- 로그인 후 사이드바 워드마크는 공개 소개 헤더와 같은 크기를 사용한다. 연구 홈의 구름은 제거하고 피드백 기록·미팅 준비·글쓰기 바로가기를 제공한다.
- 기록 바로가기는 실제 대상 미팅명을 표시한다. 진행 중인 기록을 우선하고 완료·보관 미팅을 자동으로 다시 열지 않는다. 대상이 없으면 미팅 생성 뒤 기록으로 이동한다. 마이크는 사용자의 별도 시작·동의 뒤 실행한다.


## 복제본 선별 반영 및 화면 피드백 (2026-11-06)

- `RMS_improved`는 참고 복제본이다. 원본을 덮어쓰지 않고 기존 저장·권한·검토 규칙을 보존하며 선별 적용한다. 검토 기록은 `../../docs/development/clone-review-20261106.md`.
- 교수 응답 문구는 ‘수정 내용 확인’·‘추가 수정 필요’를 유지한다. 반영 기록 존재와 완료를 혼동하지 않는다.
- 사용자가 휴지통의 명시적 완전 삭제를 요청했다. 소유자·휴지통 상태·연구 이름 입력을 확인하고 실행한다. 자동 영구 삭제는 계속 금지하며, 보관·휴지통 이동은 되돌릴 수 있다.
- 로그인에 시연·발급 계정 설명과 교수 복귀 설명을 반복하지 않는다. 가상 연구 생성 UI를 제거하되 기존 데이터를 임의 삭제하지 않는다.
- 사이드바 도우미는 일반 아이콘으로 통일한다. 파란 메뉴 호버와 중립 저장 상태를 사용한다. 기존 Margin 색상과 공개·사이드바 로고 크기 일치를 유지한다.
- 사용자 시각 검증 방침을 유지한다. 코드·테스트·배포·HTTP 검증과 실제 로그인·마이크·AI 검증을 구분한다.

## GitHub 최신본 확인 및 동기화 (2026-11-07)

- 사용자 요청에 따라 GitHub 원격 저장소(`gitkyun/Margin`)의 최신 상태를 확인하고, 폴더명 변경(Margin)에 따른 내부 README, 문서, 패키지 설정(`margin-web`)을 갱신했다.
- 검증 테스트(`npm test`, `npm run test:backend`, `npm run test:sites`, `npm run build`, `/Users/kyun/.gemini/fable-verify.sh`)를 통과한 후 GitHub 원격에 커밋 및 푸시를 수행한다.
