# Kokonut UI 매핑 및 진행 현황

마진(Margin)의 AI·계정 메뉴 화면을 [Kokonut UI](https://kokonutui.com/docs) 원본 구조·치수·모션에 맞춰 적용한 기록입니다. 색·글자·간격은 Wanted Montage 4.2.0 토큰을 따르며, `npx shadcn add`로 원본을 그대로 넣지 않습니다.

## 1. 부품별 적용 현황

| Kokonut 부품 | 마진 파일 | 상태 | 비고 / 이유 |
| :--- | :--- | :--- | :--- |
| [AI Input Selector (`ai-prompt`)](https://kokonutui.com/docs/ai/ai-prompt) | `src/pages/ResearchAssistant.tsx`, `src/components/ai/ComposerCommands.tsx`, `src/pages/assistant.css` | **적용 (1단계)** | 회색 바깥 면+흰 카드, `/` 명령 메뉴(`CommandMenu`, `CommandPill`), 즉시 비우기, `↑` 직전 질문 복원, `Esc` 중단 적용 |
| [AI Input Search (`ai-input-search`)](https://kokonutui.com/docs/ai/ai-input-search) | `src/components/ai/AIComposerBanner.tsx`, `src/pages/ResearchAssistant.tsx` | **적용 (1단계)** | 명령 선택 시 머리 띠 설명·`바꾸기 /` 전환 및 도구 줄 근거 아이콘 스택 적용 |
| [AI Message Queue (`ai-message-queue`)](https://kokonutui.com/docs/ai/ai-message-queue) | `src/pages/ResearchAssistant.tsx`, `src/components/ai/ComposerCommands.tsx` | **적용 (1단계)** | 응답 대기 중 `Enter`로 대기 줄 추가, 순서 변경·편집·삭제·지금 보내기(중단 후 전송) 지원 |
| [AI Context Meter (`ai-context-meter`)](https://kokonutui.com/docs/ai/ai-context-meter) | `src/pages/ResearchAssistant.tsx`, `src/components/ai/ComposerCommands.tsx` | **적용 (1단계)** | 서버 실제 한도(근거 50,000자·8개, 대화 10개·30,000자, 질문 2,000자) 기준 고리 게이지, Compact 대신 '새 대화' 배치 |
| [AI Attachment (`ai-attachment`)](https://kokonutui.com/docs/ai/ai-attachment) | `src/pages/ResearchAssistant.tsx`, `src/components/ai/ComposerCommands.tsx` | **적용 (1단계)** | 입력창 위·질문 말풍선 첨부 카드(이름·쪽·크기·실제 업로드/읽기/실패 상태) 적용 |
| [AI Voice (`ai-voice`)](https://kokonutui.com/docs/ai/ai-voice) | `src/pages/ResearchAssistant.tsx`, `src/lib/use-dictation.ts`, `src/components/recording/LiveWaveform.tsx` | **적용 (1단계)** | 실시간 파형+시간+흐린 받아쓰기 미리보기, 멈춤 후 버리기/글로 넣기/보내기(미저장이라 다시 듣기 제외), `VoiceGlow` 제거 |
| [Account Menu (`profile-dropdown`)](https://kokonutui.com/docs/navigation/profile-dropdown) | `src/components/WorkspaceShell.tsx` | **적용 (2단계)** | Status·계정 전환 제외, 인라인 테마 줄·길게 눌러 로그아웃 적용 |
| [Switch Button (`switch-button`)](https://kokonutui.com/docs/buttons/switch-button) | `src/components/ThemeSwitch.tsx` | **적용 (2단계)** | 실제 테마가 바뀔 때만 View Transitions 원형 확산 |
| [AI Model Selector (`ai-model-selector`)](https://kokonutui.com/docs/ai/ai-model-selector) | `src/components/ai/AIModelSelector.tsx` | **적용 (2단계)** | 입력창은 2칩 유지, 설정·작업대용 모델+깊이 눈금 트랙 통합 |
| [AI Tool Calls (`ai-tool-calls`)](https://kokonutui.com/docs/ai/ai-tool-calls) | `src/pages/assistant/AssistantThinking.tsx` | **적용 (3단계)** | 가짜 타이머 제거, 실제 시계 경과 시간·접힌 단계 요약 한 줄 |
| [AI State Loading (`ai-loading`)](https://kokonutui.com/docs/ai/ai-loading) | `src/pages/assistant/AssistantThinking.tsx`, `src/pages/student/AIWorkbench.tsx`, `src/pages/student/RevisionSuggestions.tsx` | **적용 (3단계)** | 첫 질문 대기·작업대 대기 통일(`WorkbenchLoading`) |
| [AI Inline Citations (`ai-citations`)](https://kokonutui.com/docs/ai/ai-citations) | `src/pages/assistant/AssistantMessageText.tsx` | **적용 (3단계)** | 호버/포커스 출처 스냅샷 미리보기·상호 강조 |
| [AI Autocomplete (`ai-autocomplete`)](https://kokonutui.com/docs/ai/ai-autocomplete) | `src/pages/writing/WritingAutocomplete.tsx` | **적용 (4단계)** | 커서 뒤 고스트 텍스트(`Tab` 전체·`→` 한 단어·`Esc` 닫기) |
| [AI Inline Edit (`ai-inline-edit`)](https://kokonutui.com/docs/ai/ai-inline-edit) | `src/pages/writing/WritingReview.tsx`, `supabase/functions/ai-assist/` | **적용 (4단계)** | 선택 문장 인라인 재작성·단어 diff(`ai-assist` `inline_edit` 모드 추가) |
| [AI Send (`ai-send`)](https://kokonutui.com/docs/ai/ai-send) | `src/pages/reviews/ReviewNotifyBar.tsx`, `src/pages/settings/ProjectInvites.tsx` | **적용 (5단계)** | 받는 사람·제목·본문 확인 + 5초 되돌리기 카운트다운 |
| [AI Schedule (`ai-schedule`)](https://kokonutui.com/docs/ai/ai-schedule) | `src/components/meeting/AvailabilityGrid.tsx` | **적용 (5단계)** | 투표 기반 확정 요약 카드(캘린더 연동 없음) |
| [AI Handoff (`ai-handoff`)](https://kokonutui.com/docs/ai/ai-handoff) | `src/pages/assistant/AnswerActions.tsx` | **적용 (5단계)** | '교수님 검토로 넘기기' → `ReviewsPage?new=1` 연결 |
| [Clip Trimmer (`clip-trimmer`)](https://kokonutui.com/docs/media/clip-trimmer) | `src/components/recording/SourceAudioClip.tsx` | **적용 (5단계)** | 양끝 손잡이 + 반복 재생(기존 눈금 대체) |
| `AI Checkout` · `AI Agent Lanes` | — | **제외** | 결제 미연결, 하위 에이전트 구조 없음 |
| `Image Generation Card` | — | **제외** | 생성형 이미지 기능 미구현 |

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
