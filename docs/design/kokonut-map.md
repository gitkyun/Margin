# Kokonut 원본 소스 도입 기록

2026-11-16 사용자 결정: 공식 데모를 마음에 들어 도입하는 것이므로 **원본 구조·치수·간격·정렬·모션·상호작용을 기준으로 유지**한다. 색·Pretendard·한글 문구·일본어 사전과 실제 제품 데이터/기능만 연결한다. Kokonut 범위에서는 Montage 부품으로 재구현하지 않는다. 지침은 저장소와 앱의 AGENTS.md에 기록했다.

이전 문서의 ‘적용’에는 참고 재구현이 포함돼 있었다. 아래는 이번에 공식 레지스트리의 실제 소스를 로컬 파일로 도입한 범위다. **코드 도입과 자동 검사는 사용자 시각 검수 완료를 뜻하지 않는다.** 후속 요청에 따라 에이전트도 실제 데모와 로컬 화면 스크린샷을 확인했다. 모바일과 실서비스 AI·마이크·메일 검증은 이번 완료 주장에 포함하지 않는다.

## 실제 도입 18개

원본 수정본: 모두 `apps/home-preview/src/components/kokonut/{부품}.tsx`. 표의 연결 파일은 앱의 `src/components/` 또는 `src/pages/` 아래다.

| 부품 | 실제 연결 | 제품 기능에 따른 차이 |
| --- | --- | --- |
| [profile-dropdown](https://kokonutui.com/r/profile-dropdown.json) | `WorkspaceShell.tsx` | 계정 전환·상태 변경 제외. 한 계정과 실제 설정/로그아웃 연결. 사이드바 아래에서 위로 열리도록 위치만 연결. |
| [switch-button](https://kokonutui.com/r/switch-button.json) | `ThemeSwitch.tsx` | 원본 SVG·View Transitions. 기존 테마 제공자의 data-theme와 연결. |
| [ai-prompt](https://kokonutui.com/r/ai-prompt.json) | `ResearchAssistant.tsx` | 원본 입력창의 실제 모델·깊이·명령·첨부·중단/대기 연결. 후속 사용자 요청으로 최대 760px 가변 폭, 이전 모델/깊이 두 칩, 왼쪽 음성, 위 추천/아래 사용량으로 명시적 조정. |
| [ai-input-search](https://kokonutui.com/r/ai-input-search.json) | `ResearchAssistant.tsx` | 근거가 있거나 요청 종류를 고른 경우 원본 검색 입력창. 원본 두 입력창을 한 부품으로 재조립하지 않음. |
| [ai-message-queue](https://kokonutui.com/r/ai-message-queue.json) | `ai/ComposerCommands.tsx` | 원본 QueueList를 분리해 실제 대기 질문 순서·편집·삭제·즉시 전송에 연결. |
| [ai-context-meter](https://kokonutui.com/r/ai-context-meter.json) | `ai/ComposerCommands.tsx` | 후속 사용자 요청으로 실제 입력창에서는 제거하고 아래에 실제 사용량을 표시. 원본 고리는 로컬 시연에서만 비교 가능. |
| [ai-attachment](https://kokonutui.com/r/ai-attachment.json) | `ai/ComposerCommands.tsx` | 실제 파일 정보·처리 상태. 없는 PDF 썸네일·쪽 번호는 만들지 않음. |
| [ai-voice](https://kokonutui.com/r/ai-voice.json) | `ResearchAssistant.tsx` | 실제 마이크 분석·받아쓰기. 데모 파형 제외, 저장하지 않는 음성의 재생 버튼 비활성. |
| [ai-model-selector](https://kokonutui.com/r/ai-model-selector.json) | `ai/AIModelSelector.tsx` | 설정·작업대에서 원본 모델 목록과 답변 깊이 트랙을 실제 모델에 연결. |
| [ai-tool-calls](https://kokonutui.com/r/ai-tool-calls.json) | `assistant/AssistantThinking.tsx` | 서버가 세부 도구 이벤트를 주지 않아 실제 요청 한 행으로 표시. 가상 단계 진행 제외. |
| [ai-loading](https://kokonutui.com/r/ai-loading.json) | `assistant/AssistantThinking.tsx` | 첫 답변·작업대 대기의 실제 요청 상태를 원본에 전달. |
| [ai-citations](https://kokonutui.com/r/ai-citations.json) | `assistant/AssistantMessageText.tsx` | 원본 인용 미리보기와 출처 목록. 안전한 마크다운 렌더러와 실제 근거 스냅샷 유지. |
| [ai-autocomplete](https://kokonutui.com/r/ai-autocomplete.json) | `writing/WritingAutocomplete.tsx` | 원본 고스트/수락 바를 TipTap에 연결. 실제 제안·커서 검증·단어 수락 유지. |
| [ai-inline-edit](https://kokonutui.com/r/ai-inline-edit.json) | `writing/WritingReview.tsx` | 원본 선택 도구막대·단어 비교를 TipTap에 연결. 중단·반영 전 원문 일치 검증 유지. |
| [ai-send](https://kokonutui.com/r/ai-send.json) | `reviews/ReviewNotifyBar.tsx · settings/ProjectInvites.tsx` | 원본 5초 뒤 전송/되돌리기. 서버가 본문 편집을 지원하지 않아 본문은 읽기 전용. 대상 변경 시 예약 취소. |
| [ai-schedule](https://kokonutui.com/r/ai-schedule.json) | `meeting/AvailabilityGrid.tsx` | 원본 시간 칸·카드. 실제 다중 시간 투표 때문에 단일 선택을 체크박스 다중 선택으로 변경. 캘린더 연동은 없음. |
| [ai-handoff](https://kokonutui.com/r/ai-handoff.json) | `assistant/AnswerActions.tsx` | 원본 카드에 실제 검토 요청 만들기 연결. 상담원·대기열 대신 “검토 요청 전”과 공유 범위 표시. |
| [clip-trimmer](https://kokonutui.com/r/clip-trimmer.json) | `recording/SourceAudioClip.tsx` | 원본 트리머를 실제 음성에 연결. 영상 영역은 녹음 제목, 실제 음성 구간·반복·키보드 조절. |

## 의존성과 원본 증빙

- 원본에 쓰인 Motion·Lucide·Radix를 사용한다. shadcn 방식의 드롭다운/텍스트 입력/높이 조절 부품은 `components/kokonut/primitives/`에 두어 기존 Montage 부품과 분리했다.
- 원본 작성자·버전·MIT 헤더를 유지했다. 공식 레지스트리 주소와 **수정 전** 소스/레지스트리의 SHA-256은 [소스 명세](kokonut-source-manifest-20261116.json)에 기록했다. 이후 공식 사이트가 갱신되면 해시가 달라질 수 있다.
- MIT 전문은 `apps/home-preview/public/licenses/Kokonut-MIT.txt`에 보존했다.
- 공통 색상 변수는 라이트·다크 테마를 따른다. 기존 프로필/입력창 CSS가 원본 내부를 다시 덮지 않도록 연결을 제거하거나 마크다운 영역으로 범위를 좁혔다.
- 제외: AI Checkout·AI Agent Lanes·Image Generation Card. 실제 기능이 없으므로 도입 완료로 세지 않는다.

## GitHub 동기화 확인

2026-11-16 확인한 최신 `origin/main`: `0e7c1737a802e5a2ad1a88b9981c55ba3356c42d`.
#89 연구 흐름 카드, #90 완료된 연구/다시 진행, #91 진행 중인 연구 개수 표시를 로컬 수정본에 포함했다. 작업 브랜치를 병합하거나 커밋/푸시하지 않았으며 로컬 수정이 남아 있다.

## 2. 나중에 (이번 1~5단계 범위 밖)

* 순서 바꾸기 되돌리기 (`SortableListUndo`)
* 밀어서 확인 플릭 제스처
* 폴더 트리 방향키 탐색 (`role="tree"`)
* 태그 칩 `←`/`→` 이동·중복 플래시
* 연구 카드 컨텍스트 메뉴 열림 강조
* `⌘K` 최근 방문 우선 랭킹
* 버전 비교 슬라이더 첫 진입 힌트 스윕
* 주요 목표 타임라인 가로/포커스 확대
* 스마트 제안 카드 신뢰도·대안 전환
* PDF 미리보기 레일 (`Preview Rail`)
* 토스트 스택 교체 (`Kobra Toast`)
* 사용량 임계치 색상 경고 (저장 한도 확정 후 진행)
* 단축키 도움말 OS별 키 표기 통일 (확인 필요)
* `AI Checkout` (결제 연결 후)
* `AI Conversation Branches` (대화 트리 저장 구조 변경 필요)


## 스크린샷 후속 수정

- 전역 HTML 기본 font/배경/resize/placeholder/focus 규칙을 base 레이어로 옮겨 원본 유틸리티를 덮지 않게 했다. 화면 전용 CSS의 레이어 순서를 전부 바꾸지 않았다.
- 접힌 프로필 트리거 40×40px, 아바타 32px. 실제 접속 상태를 추적하지 않으므로 초록 점을 표시하지 않는다.
- 원본 배경 틴트가 단색 위험/경고색으로 바뀌어 같은 색 글자가 사라진 것을 고쳤다. 글자에 다시 투명도를 곱하는 대신 기존 테마의 본문/보조/부가 글자색을 사용한다.
- 첨부 UI는 부모의 실제 contexts를 단일 상태로 사용한다. 겉의 칩만 지우고 파일은 계속 보내는 상태 분리를 막았다. 확인되지 않은 전체 쪽 수와 가상 페이지는 표시하지 않는다.
- 초기 검증 실패시 질문을 복원하고, 음성 패널을 닫을 때 실제 받아쓰기도 중단한다.
- 로컬 시연은 앱의 dev/kokonut-review.html이다. 별도 개발 진입점으로 Vite 프로덕션 기본 빌드에 포함되지 않는다. 시연의 가상 내용은 실제 AI 결과/메일/일정 저장이 아님을 표시한다.
