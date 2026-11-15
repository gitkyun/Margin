# 마진(Margin) UI·UX 개선 결정사항 및 AI 인계서 (2026-11-15)

- **작성 목적**: 사용자가 9개 무료 UI 라이브러리 비교 및 마진(`apps/home-preview/src`) 전수 점검 제안을 검토한 뒤 확정한 **최종 선택사항·보류사항·제외사항**을 정리해, 다음 작업 세션이나 다른 AI 에이전트에게 그대로 인계하기 위한 문서입니다.
- **함께 읽을 문서**:
  - [AGENTS.md](../../../AGENTS.md): 제품 불변 조건, Montage 4.2.0 토큰 규칙, UX 라이팅(해요체), 일본어 i18n(`t("...")`) 규칙
  - [ux-redesign/README.md](README.md) · [design-b.md](design-b.md) · [upper-review-2026-11-14.md](upper-review-2026-11-14.md)
  - [free-ui-libraries-reference-2026-11-15.md](free-ui-libraries-reference-2026-11-15.md): 9개 무료 UI 라이브러리 전체 카탈로그, 공식 링크, 섹션별 전체 제안 아카이브

---

## 0. 인계 AI가 반드시 지켜야 할 구현 원칙

1. **디자인 시스템 충돌 금지**: 선택한 외부 라이브러리(beUI, Arc UI, Bencho, BoardUI, affectUI, Kobra, Watermelon UI, Transitions.dev, Libraries.dev)의 컴포넌트를 가져오더라도 **색상·간격·반경·타이포그래피는 반드시 `Wanted Montage 4.2.0` 토큰(`src/design/tokens.css`, `montage.css`)으로 매핑**한다. 자체 hex 색상표·`.dark` 블록·`*-refinements.css`를 추가하지 않는다.
2. **로그인 후 시각 제한**: 로그인 후 화면에서는 **구름 셰이더(`CloudShader`), 유리(backdrop-blur) 및 광학 굴절 효과를 금지**한다. (단, 패널 크로스 블러 전환 등 모션 스니펫은 불투명 표면과 reduced-motion 가드를 준수해 적용)
3. **상태 분리 원칙 유지**: `작업 완료 ≠ 학생 반영 기록 ≠ 교수 결과 ≠ 댓글 해결 ≠ 읽음` 상태를 절대 합치지 않는다.
4. **다국어(`t()`) 및 접근성**: 새로 추가되는 모든 한국어 UI 문구는 `t("한국어 원문")`으로 감싸고 `apps/home-preview/src/i18n/ja` 사전을 함께 갱신한다. `prefers-reduced-motion`을 반드시 지원한다.

---

## 1. 크로스 조합 아이디어 (섹션 0) 결정사항

| 번호 | 제안 항목 | 사용자 결정 | 구현 방향 및 대상 파일 |
| :--- | :--- | :--- | :--- |
| **#1** | 나만의 연구 에이전트 & 3인 서브에이전트 병렬 점검 | **단일 에이전트로 축소 채택** | 멀티 서브에이전트 병렬 실행은 제외. **계정 설정 › AI 탭(`SettingsPage.tsx`)** 등에 **‘나만의 연구 에이전트’ 1개**를 만들어 개인 지침·말투를 설정하고, [Libraries.dev Bots](https://libraries.dev/bots)의 귀여운 봇 아바타를 선택·적용해 `ResearchAssistant.tsx` 및 패널(`AIWorkbench.tsx`)에 표시. |
| **#2** | 교수님 음성 타임스탬프 ↔ 전사문 ↔ 피드백 연결 | **채택** | `RecordingPanel.tsx`, `SavedTranscript.tsx`, `FeedbackPage.tsx`: 전사문 문장을 드래그해 피드백으로 저장할 때 해당 구간 오디오 타임스탬프를 함께 저장하고, 피드백 상세에서 1클릭으로 해당 구간 음성을 파형 스크러버로 재생. |
| **#3** | 글쓰기 → AI 문장 점검 → 검토용 PDF → 수정 결과 루프 | **채택** | `WritingPage.tsx`, `ResultsPage.tsx`: ‘AI 문장 점검’ 클릭 시 `/assistant`로 이동하지 않고 에디터 오른쪽 여백 패널에서 인라인 점검·반영. ‘검토용 PDF’ 생성 시 다운로드·재업로드 없이 자료/수정 결과로 바로 연결. |
| **#4** | 투고일 역산 + 교수 검토 버퍼 + 지연 시뮬레이션 | **보류 (제외)** | 사용자가 별로라고 판단해 추후 재검토로 보류. |
| **#5** | 모션 토큰 3단계 + `Transitions.dev` 순수 CSS 전환 통합 | **채택** | 마진의 `--motion-*` 3단계(120/200/300ms)와 [Transitions.dev](https://transitions.dev/) 순수 CSS 스니펫(`prefers-reduced-motion` 내장)을 통합해 경량 마이크로 인터랙션 적용. |
| **#6** | 절제된 청각 피드백 (`Bencho` / `Kobra` Sound) | **채택** | [Bencho Sounds](https://bencho.dev/sounds) / [Kobra Sound](https://kobra.systems/components/sound) 활용. 계정 설정에서 효과음 On/Off 가능하게 두고 녹음 시작·종료, 할 일 완료, 링크 복사 등 핵심 순간에만 적용. |

---

## 2. 섹션별 확정 구현 범위

### 섹션 1. 공개 사이트 · 인증 · 초대 (`/`, `/features`, `/pricing`, `/guide`, `/login`, `/signup`, `/join`)
* **채택 항목**:
  * FAQ 아코디언 여닫기 고도화 ([Transitions.dev](https://transitions.dev/) `Accordion expand` / [Watermelon UI Accordion](https://ui.watermelon.sh/components/accordion))
  * 가입/비밀번호 변경 시 비밀번호 강도 표시 ([Arc UI](https://uiarc.dev/) `Password strength`)
  * 입력 오류(로그인 실패, 이메일/비밀번호 오타) 시 입력칸 흔들림 ([Transitions.dev](https://transitions.dev/) `Error state shake`)
* **대상 파일**: `pages/PublicPages.tsx`, `pages/AuthPages.tsx`, `pages/InvitePages.tsx`, `pages/JoinPage.tsx`
* **제외 항목**: 히어로 구름/빛 변경, 푸터 마스코트 변경, 체험 계정 원클릭 필 등.

### 섹션 2. 온보딩 (`/r/new`) & 내 연구 목록 (`/r`)
* **채택 항목**:
  * 소개 3장·온보딩 단계 진행 및 인디케이터 고도화 ([Bencho Step player](https://bencho.dev/blocks/step-player) / [beUI](https://beui.dev/components/motion))
  * 지도교수 이메일·연구 질문 입력을 칩 태그 입력으로 개선 ([affectUI Tag Input](https://www.affectui.com/components/tag-input))
  * 질문 단계 전환 시 카드 높이 보간 ([Transitions.dev](https://transitions.dev/) `Card resize`)
  * 온보딩 3단계(다음 미팅)에 **‘투고/제출 목표일’ 선택 입력 추가**
  * 내 연구 목록(`/r`) 카드 **우클릭 컨텍스트 메뉴 지원** ([BoardUI Context Menu](https://www.boardui.com/components/context-menu)) 및 상태 배지 적용 ([beUI Animated Badge](https://beui.dev/components/motion))
* **대상 파일**: `pages/OnboardingPage.tsx`, `pages/AuthPages.tsx` (`ResearchSelectPage`)

### 섹션 3. 글로벌 셸 · 사이드바 · 상단 줄 · `⌘K` · 여백 패널
* **채택 항목**:
  * 계정 메뉴 카드 레이아웃 정돈 ([affectUI Profile Menu](https://www.affectui.com/components/profile-menu)) 및 사이드바/카드 호버 반응 개선
  * 사이드바 `피드백` 메뉴에 **새 교수 응답 상태 점(Dot)** 표시 ([BoardUI](https://www.boardui.com/components))
  * `?` 단축키 도움말 창(`ShortcutHelp.tsx`) 키캡 시인성 강화 ([affectUI Kbd](https://www.affectui.com/components/kbd))
  * `+` 만들기 메뉴 및 `⌘K`(`command-items.ts`)에 **‘피드백 추가’** 포함 + `⌘K` 검색 범위를 메모·피드백 본문·교수 댓글까지 확장
  * 오른쪽 여백 패널(`MarginPanel.tsx`) **경계선 드래그로 너비 조절** ([affectUI Resizable](https://www.affectui.com/components/resizable)) 및 **패널 크로스 블러 전환** ([Transitions.dev](https://transitions.dev/) `Panel reveal`)
* **대상 파일**: `components/WorkspaceShell.tsx`, `components/CommandPalette.tsx`, `components/ShortcutHelp.tsx`, `components/margin-panel/MarginPanel.tsx`, `lib/command-items.ts`

### 섹션 4. 연구 홈 (`/r/:researchId`)
* **채택 항목**:
  * ‘확인할 내용’ 카드에 디시전 인박스 패턴 적용 ([affectUI](https://www.affectui.com/))
  * KPI 숫자 변경 시 롤링 모션 ([Bencho Rolling counter](https://bencho.dev/blocks/rolling-counter) / [Transitions.dev](https://transitions.dev/) `Number subtle change`)
  * 시작 체크리스트 UI/완료 모션 고도화 ([Bencho Checklist](https://bencho.dev/blocks/checklist) / [affectUI](https://www.affectui.com/))
  * 홈 상단에 **‘투고일까지 D-Day’ 표시까지만 추가** (스파크라인·기타 부가 문구 제외)
* **대상 파일**: `pages/HomePage.tsx`, `components/home/StartChecklist.tsx`, `components/RollingNumber.tsx`, `lib/home-kpis.ts`

### 섹션 5. 미팅 · 실시간 녹음/전사 · 결정/질문
* **채택 항목**:
  * 미팅 준비 탭 안건/질문 **Sortable List** 드래그 정렬 ([beUI](https://beui.dev/components/motion))
  * 결정 기록(`DecisionLog.tsx`) **타임라인 시각화** ([beUI Timeline](https://beui.dev/components/motion/timeline))
  * 미팅 시간 조율 스케줄러 고도화 ([beUI Availability Scheduler](https://beui.dev/components/blocks))
  * **녹음은 실시간 음성 파형만 적용** ([Libraries.dev Voice](https://libraries.dev/voice) — `Voice Orb` 제외) + 다른 화면 이동 시 상단 **미니 녹음 컨트롤** 유지 ([Bencho Dynamic island](https://bencho.dev/blocks/dynamic-island))
  * 메모/전사문 텍스트 드래그 시 **플로팅 팝오버**(`+ 피드백`, `+ 결정`, `+ 질문`) ([Watermelon UI Quick Feedback](https://ui.watermelon.sh/animated-components/quick-feedback) / [beUI](https://beui.dev/components/blocks/overflow-actions))
  * **10초 이상 무음/마이크 끊김 경고** ([Transitions.dev](https://transitions.dev/) `Error state shake`), **음성 인식 저신뢰 학술 용어 점선 밑줄 표시**, **전사본 인라인 형광펜 마킹**, **오디오 타임스탬프 연결**
* **대상 파일**: `pages/student/MeetingsPage.tsx`, `pages/student/DecisionLog.tsx`, `components/RecordingPanel.tsx`, `components/SavedTranscript.tsx`, `lib/live-speech.ts`, `lib/live-transcript.ts`

### 섹션 6. 피드백 · 수정 방법 · 할 일
* **채택 항목**:
  * 피드백·수정 결과·검토 요청 **탭별 건수 및 새 응답 점** 표시 ([BoardUI Counter](https://www.boardui.com/components/counter) + [Transitions.dev](https://transitions.dev/))
  * 수정 방법 AI 제안에 **스마트 제안 카드** 적용 ([affectUI Smart Recommendation](https://www.affectui.com/components/smart-recommendation))
  * 상태/미팅 **다중 필터 정돈** ([affectUI Filter Menu](https://www.affectui.com/r/filter-menu-clean.json))
  * 피드백 상세 5번째 칸(‘교수 확인’)에 **‘교수에게 보내기’ 버튼 직접 탑재**
  * 할 일 완료 시 **체크 선 드로잉** ([Transitions.dev](https://transitions.dev/)) + **되돌리기 토스트** ([Kobra Toast](https://kobra.systems/components/toast)) + **행 자체 언두 액션** ([Watermelon UI Timed Undo Action](https://ui.watermelon.sh/animated-components/category/buttons))
  * **스와이프 토글은 모바일 뷰포트(`767px 이하`)에서만 적용** ([beUI Swipeable List](https://beui.dev/components/blocks/swipeable-list))
* **대상 파일**: `pages/student/FeedbackPage.tsx`, `pages/student/TasksPage.tsx`, `pages/student/shared.tsx`, `lib/use-task-completion.ts`, `components/task-row-motion.ts`

### 섹션 7. 수정 결과 · 검토 요청 · 교수/학생 3열 검토
* **채택 항목**:
  * 수정 결과 작성 **모핑 모달 및 필수 입력 누락 시 흔들림** ([beUI](https://beui.dev/components/motion) / [Transitions.dev](https://transitions.dev/))
  * 공유 중지 시 실수 방지 **슬라이드 확인** ([Bencho Slide to confirm](https://bencho.dev/blocks/slide-confirm))
  * 링크 생성 후 학생이 원할 때 누르는 **‘교수님께 메일로도 알리기’** (Resend 연동, `링크 생성≠전송` 유지)
  * 3열 검토 상세에서 **열 너비 드래그 조절로 PDF 넓게 열람** ([affectUI Resizable](https://www.affectui.com/components/resizable))
  * **댓글 스레드 및 인라인 편집 정돈** ([affectUI Comment Thread](https://www.affectui.com/components/comment-thread) / [Kobra Conversation](https://kobra.systems/components/conversation))
  * **해결된 댓글 접기 및 차수·첫 줄 요약 헤더 유지** ([Watermelon UI Accordion](https://ui.watermelon.sh/components/accordion) / [Transitions.dev](https://transitions.dev/))
  * 댓글 속 페이지 앵커(`p.4` 등) 클릭 시 **중앙 `PdfViewer` 해당 페이지 즉시 점프**
* **대상 파일**: `pages/student/ResultEditorDialog.tsx`, `pages/student/ResultsPage.tsx`, `pages/reviews/ReviewsPage.tsx`, `pages/reviews/ReviewDetailPage.tsx`

### 섹션 8. 문서: 글쓰기 & 자료 & PDF 뷰어
* **채택 항목**:
  * TipTap 에디터 **인라인 AI 문장 점검** ([Kobra AI Editor](https://kobra.systems/components/ai-editor) 패턴을 여백 패널/인라인으로 통합)
  * **슬라이드 비교 고도화** ([beUI Before After Slider](https://beui.dev/components/motion) / [Bencho Image compare](https://bencho.dev/blocks/image-compare))
  * **1.5초 자동 저장 상태 텍스트 블러 교체** (`저장 중` ↔ `저장됨`, [Transitions.dev](https://transitions.dev/) `Text states swap`)
  * 자료 **드래그 앤 드롭 업로드 및 청크 진행률** ([Watermelon UI File-upload](https://ui.watermelon.sh/blocks/file-upload) / [Bencho](https://bencho.dev/blocks/upload-dropzone) / [BoardUI](https://www.boardui.com/components/file-upload))
  * **폴더 트리 및 드래그 이동** ([beUI File Tree](https://beui.dev/components/motion) / [BoardUI Tree View](https://www.boardui.com/components))
  * **PDF 썸네일 로딩 및 여백 미리보기 레일** ([Libraries.dev Image](https://libraries.dev/image.html) / [beUI Preview Rail](https://beui.dev/components/motion))
* **대상 파일**: `pages/WritingPage.tsx`, `components/VersionCompareSlider.tsx`, `pages/student/MaterialsPage.tsx`, `pages/student/MaterialUploadField.tsx`, `components/MaterialFolders.tsx`, `components/PdfViewer.tsx`

### 섹션 9. 일정: 로드맵 · 투고일 역산 · 캘린더 · 시간 조율
* **채택 항목**:
  * **시간순 마일스톤 카드** ([beUI Timeline](https://beui.dev/components/motion/timeline))
  * 관계도(`RoadmapDiagram.tsx`) **노드 디자인 및 현재 진행 단계 강조** ([Bencho Action node](https://bencho.dev/blocks/action-node) + [Libraries.dev Border beam](https://libraries.dev/beam.html))
  * **AI 미연결 환경용 균등 배분 기본 로드맵 초안** 제공 (`roadmap-plan.ts`)
* **보류 항목**: 교수 검토 버퍼 자동 삽입, 지연 시뮬레이션 고스트 막대.
* **대상 파일**: `pages/PlanningPage.tsx`, `pages/RoadmapDiagram.tsx`, `lib/roadmap-plan.ts`

### 섹션 10. 연구 설정 & 계정 설정
* **채택 항목**:
  * 연구 삭제: **슬라이드해서 바로 삭제** ([Bencho Slide to confirm](https://bencho.dev/blocks/slide-confirm)) — `AGENTS.md` 및 `docs/architecture.md`의 기존 연구명 입력 규칙은 슬라이드 확인 방식으로 개정 완료됨.
  * 연구 기본 정보 탭: **연구 키워드(칩 태그) 및 지도교수(최대 5명) 관리** ([affectUI Tag Input](https://www.affectui.com/components/tag-input)) + **‘목표 학회 인용 양식 프리셋(APA, IEEE, ADR 등)’** 추가
  * 계정 설정 › 화면 탭: `HourStyleSwitch.tsx` 전환 시 **예시 시각(`14:00` ↔ `오후 2:00`) 회전 및 즉시 미리보기** ([Bencho Liquid toggle](https://bencho.dev/blocks/liq-toggle) + [Transitions.dev](https://transitions.dev/) `Number pop-in`) + **실제 미팅 카드 미리보기** 배치
  * 계정 설정 › AI 탭: **나만의 연구 에이전트 1개 설정(지침·말투 + [Libraries.dev Bots](https://libraries.dev/bots))** (섹션 0 #1 연계)
  * 계정 설정 › 사용량 탭: **월간 AI 사용량 및 R2 500MB 단위 스토리지 점유율 게이지** 표시 ([BoardUI Meter](https://www.boardui.com/components/meter) / [Bencho Context meter](https://bencho.dev/blocks/context-meter))
  * 계정 설정 › 알림 탭: **스위치 조작 시 즉시 저장** ([BoardUI](https://www.boardui.com/components))
* **대상 파일**: `pages/SettingsPage.tsx`, `components/PermanentResearchDelete.tsx`, `components/HourStyleSwitch.tsx`, `components/SubscriptionPlans.tsx`
