# 현재 구현 기준 · 2026-11-05

2026-11-06 소개 화면의 최종 마감은 [적용 기록](design/aceternity-sources-20261106.md)과 [검증·배포 기록](development/verification-20261106.md)을 함께 확인한다.

[승인한 확장 계약](product/experience-addendum-20261105.md) → [화면·라이브러리 적용](design/implementation-map-20261105.md) → [검증 기록](development/verification-20261105.md)을 먼저 읽는다. 기존 제품 문서는 원래 사용자 문제와 흐름의 기준으로 보존한다.

# 문서 안내

## 읽는 순서

| 순서 | 문서 | 확인할 내용 |
|---|---|---|
| 1 | [PRD](product/prd.md) | 사용자 문제·제품 목표·범위·검증 기준 |
| 2 | [기능명세서](product/functional-specification.md) | 입력·동작·상태·예외·권한·데이터 |
| 3 | [유저플로우](product/user-flow.md) | 화면과 주요 동작의 연결 |
| 4 | [IA·화면 목록](product/information-architecture.md) | 학생·교수 정보 구조, 메뉴·화면·보조 영역·진입 경로 |
| 5 | [디자인 기준](design/README.md) | shadcn/ui와 지정 참고자료의 적용 방법 |
| 6 | [수업 시연 기준](development/classroom-demo.md) | 대표 시나리오·Google API·제한 공개 배포·확인 조건 |
| 7 | [개발 안내](development/README.md) | 저장소 사용·검증·앱 초기화 전 상태 |

제품 문서는 2026-11-02에 기존 v1.0 파일을 내용 변경 없이 옮겼다. 2026-11-03에는 유저 플로우와 명세의 연계 충돌을 정리하고 Google AI API를 실제로 연결하는 수업 시연·제한 공개 배포 목표를 제품·개발 문서에 반영했다. 같은 날 IA·화면 목록을 추가해 정보의 소속·진입 경로·시연 화면을 연결했다. 현재 파일을 기준으로 작업하고 이전 내용은 Git 이력으로 확인한다. 파일 이동과 이후 내용 수정을 구분한다.

## 폴더 구분

- `product/`: 제품 기준 문서.
- `design/`: UI 방향·출처·구현 시 지킬 기준.
- `development/`: 실제 개발 환경과 작업 방법.
- `assets/`: README·문서에서 사용하는 이미지. 앱 정적 자산과 구분한다.

새 문서를 추가하거나 경로를 바꾸면 이 안내와 관련 링크를 함께 수정한다. 기능명세서의 규칙과 유저플로우가 충돌하면 해당 위치를 기록하고 정리한 뒤 구현한다.
