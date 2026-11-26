# [산출물 A] 마진(Margin) 제품 전체 지도 및 기능·구조 인벤토리

> **작성 단계**: Phase 1 (제품 전체 파악) — **사실 기반 매핑 전용** (디자인 평가·개선안 설계·코드 수정 제외)  
> **작성일**: 2026-11-24  
> **근거 소스**: `Margin-repo` 코드베이스(`apps/home-preview/src/**`), 공식 기획·설계 문서(`docs/architecture.md`, `docs/design/ia-v2/**`, `docs/product/**`), Git 이력(`4fce15e`)

---

## 1. 버전 기준선 및 문서 vs 구현 현황

### 1-1. 코드 기준선
| 항목 | 현재 상태 | 비고 |
|---|---|---|
| **로컬 Git HEAD** | `4fce15e` (`#184`: 목록 행 동작 공통화, 파일 추가 창, 넓은 화면 열 표시, 색·테두리 정리) | 직전 커밋: `c18669f` (`#183` Wave 2 Slice 1 다중 PDF 업로드), `247a576` (`#182` RQA Batch 01 반응형 수정) |
| **로컬 미커밋 파일 (4개)** | `assistant-side-panel.css`, `rqa-batch01-regression.test.tsx`, `shell.css`, `main.tsx` | 보존 대상. Phase 2에서 라이브 배포본과 대조 예정 |
| **실제 배포 사이트** | `https://margin-research.pages.dev` | Phase 2에서 Chrome 원격 디버깅 연결 후 로컬 HEAD(`4fce15e`)와의 빌드 차이 실측 예정 |

### 1-2. 기획 문서와 실제 구현의 관계
- **핵심 제품 루프 (`docs/design/ia-v2/00-README.md`, `docs/architecture.md`)**: `미팅 → 받은 말(피드백) → 할 일 → 고친 글·자료 → 검토 요청·교수 응답 → 다음 미팅`
- **IA v2 전환 상태**: 기존 왼쪽 사이드바 6메뉴 구조(`docs/product/information-architecture.md`)에서 **상단 4메뉴(`홈 · 미팅 · 할 일 · 글·자료`) + 우측 사이드 창(`도우미 · 할 일 · 결정·질문 · 자료`) + 우측 64px 아이콘 레일** 구조로 코드 전환 완료.
- **기존 문서와의 주요 차이(구현 확인)**:
  - `docs/design/ia-v2/00-README.md`는 작성 당시(11/16) "구현 전 설계안"으로 표기되어 있으나, 현재 `WorkspaceShell.tsx`, `TopBar.tsx`, `SideRail.tsx`, `DocsPage.tsx`, `TasksHome.tsx`, `RowActions.tsx` 등에 IA v2 및 `#184` 변경이 실제로 반영되어 있음.
  - `docs/design/ia-v2/01-structure.md`의 레거시 주소(`/writing`, `/materials`, `/feedback`, `/results`, `/reviews`, `/planning`, `/assistant`, `/settings`, `/account`)는 모두 `lib/legacy-routes.ts`를 통해 새 주소로 리다이렉트되도록 구현됨.
  - `AGENTS.md` 및 D13 결정(`#99`): 연구 도우미는 현재 연구의 기록을 기본으로 읽으며(최대 48,000자, 미채택 AI 제안·개인 대화·녹음/전사문 제외), 전사문은 미팅 기록의 `[정리하기]`에서만 본인 것만 전송.

---

## 2. 전체 라우트 및 정보 구조(IA) 지도

### 2-1. 공개 · 인증 · 초대 라우트 (`RmsApp.tsx`)
| 경로 | 화면 컴포넌트 | 설명 | 비고 |
|---|---|---|---|
| `/` | `LandingPage` | 서비스 소개 랜딩 | 로그인 여부(`signedIn`)에 따라 CTA 분기 |
| `/features` | `FeatureTourPage` | 기능 둘러보기 | 공개 페이지 |
| `/pricing` | `PricingPage` | 플랜 안내 | 공개 페이지 |
| `/guide` | `InfoPage` (`privacy=false`) | 사용 안내 | 공개 페이지 |
| `/privacy` | `InfoPage` (`privacy=true`) | 자료와 개인정보 안내 | 공개 페이지 |
| `/login` | `LoginPage` | 이메일·비밀번호 / 카카오·라인 소셜 로그인 | `?next=` 리다이렉트 지원(`safeNext` 검증) |
| `/signup` | `InviteSignupPage` / `SignupPage` | 회원가입(연결 모드) / 가입 과정 미리보기(preview) | 초대 코드 `?invite=` 처리 |
| `/join` | `JoinPage` | 연구 초대 메일 토큰 수락 | 비로그인→로그인 후 수락 이어짐 |
| `*` | `404 Not Found` | 커스텀 404 안내 | 로그인 여부에 따라 `/` 또는 `/r` 이동 |

### 2-2. 로그인 후 워크스페이스 라우트 (`WorkspaceShell` 내부/단독)
| ID | 경로 | 화면 컴포넌트 | 셸 적용 | 주요 쿼리 파라미터 |
|---|---|---|---|---|
| **R1** | `/r` | `ResearchSelectPage` | `Shell` (연구 밖) | `view=completed\|archived\|trash` |
| **R2** | `/r/new` | `OnboardingPage` | 단독 (셸 없음) | `intro=1` |
| **H1** | `/r/:researchId` | `HomePage` | `Shell` | `tab=tasks\|alerts\|records\|docs`, `tour=1` |
| **M1** | `/r/:researchId/meetings/:meetingId?` | `MeetingsPage` | `Shell` | `type=open\|written\|review\|poll`, `q=`, `cancelled=1`, `mode=prepare\|record`, `src=transcript\|memo`, `t=`, `at=`, `marks=1` |
| **T1** | `/r/:researchId/tasks` | `TasksHome` | `Shell` | `view=feedback`, `status=`, `q=` |
| **W1** | `/r/:researchId/docs` | `DocsPage` | `Shell` | `kind=writing\|material`, `type=`, `folder=`, `q=` |
| **W2** | `/r/:researchId/docs/w/:documentId` | `DocTabsFrame` + `WritingPage` | `Shell` (넓은 패널 440) | `side=outline\|info`, `compare=`, `suggest=1` |
| **W3** | `/r/:researchId/docs/m/:materialId` | `DocTabsFrame` + `MaterialsPage` | `Shell` (넓은 패널 440) | `ver=`, `page=` |
| **F1** | `/r/:researchId/flow` | `PlanningPage` | `Shell` | `tab=roadmap\|calendar`, `view=cards\|timeline\|diagram`, `phase=` |
| **M3/X2** | `/reviews/:requestId` | `ReviewDetailPage` | 연구 소유/참여 시 `Shell(embedded)`, 교수 단독 시 단독 | `item=`, `round=`, `#comment-<id>` |
| **M4** | `/schedule/:pollId` | `PollPage` | 연구 소유/참여 시 `Shell`, 외부 참여자 단독 | — |

### 2-3. 어느 화면에나 붙는 전역 오버레이 쿼리 (`WorkspaceShell.tsx`)
| 쿼리 | 열리는 UI | 동작 규칙 |
|---|---|---|
| `?detail=<kind>:<id>` | `ItemDetail` (사이드 창 자리에 덮임) | `kind`: `task`, `feedback`, `decision`, `question`, `result`. URL에 유지, 뒤로 가기로 닫힘 |
| `?settings=<section>` | `SettingsDialog` (모달) | 계정 6개(`profile`, `display`, `notifications`, `assistant`, `usage`, `shortcuts`) + 연구 4개(`research`, `people`, `schedule`, `danger`). 연구 밖에서 연구 구획 요청 시 `profile`로 폴백 |
| `?panel=<tab>&panelView=` | 사이드 창 탭 열기 | `tab`: `assistant`, `tasks`, `log`, `materials`. 진입 시 1회 읽고 URL에서 즉시 제거 |
| `?new=<kind>` | 인라인/모달 생성 호스트 | `record`, `written`, `meeting`, `poll`, `task`, `feedback`, `doc`, `material`, `result`, `review`. 진입 시 1회 읽고 URL에서 제거 |

### 2-4. 레거시 리다이렉트 라우트 (`lib/legacy-routes.ts`)
`/account`, `/r/:id/settings`, `/r/:id/assistant`, `/r/:id/writing/:docId?`, `/r/:id/materials/:matId?`, `/r/:id/planning`, `/r/:id/folders/:folderId`, `/r/:id/feedback/:fbId?`, `/r/:id/tasks/:taskId`, `/r/:id/results/:resId?`, `/r/:id/reviews`, `/r/:id/questions/:id`, `/r/:id/decisions/:id` → 모두 현행 IA v2 경로 및 쿼리로 `replace` 리다이렉트.

---

## 3. 사용자 역할 및 권한 매트릭스 (`docs/architecture.md`, `RmsApp.tsx`, `AuthPages.tsx`)

| 기능 / 영역 | 학생 소유자 (`owner`) | 공동연구자 (`editor`, active) | 지도교수 (`incomingOnly`) | 비로그인 / 미승인 |
|---|---|---|---|---|
| 공개 페이지 (`/`, `/features`, `/pricing`, `/guide`, `/privacy`) | 접근 | 접근 | 접근 | 접근 |
| 연구 생성 (`/r/new`) · 내 연구 (`/r`) | 전체 | 참여 연구만 | 받은 검토 요청·시간 조율만 표시 | 불가 (`/login` 이동) |
| 공동 기록(미팅·피드백·할 일·글·자료·단계·목표) 편집 | 전체 | `shared` 기록 편집 | 불가 | 불가 |
| 개인 기록(`visibility: "private"`), AI 대화, 미채택 AI 제안, 본인 전사문 | 본인 것만 | 본인 것만 | 불가 | 불가 |
| 공동연구자 초대 · 접근 해제 · 초대 취소 | 가능 | 불가 (소유자 전용) | 불가 | 불가 |
| 지도교수 이메일 초대 | 가능 | 가능 | 불가 | 불가 |
| 연구 보관 · 복원 · 휴지통 이동 · 완전 삭제 | 가능 (완전 삭제는 소유자 + 휴지통 상태) | 불가 | 불가 | 불가 |
| 검토 요청 생성 · 공유 설정 · 재확인 요청 | 가능 | 가능 | 불가 | 불가 |
| 검토 화면 응답(`confirmed` / `changes_requested`) · 댓글 · 핀 | 조회·댓글·재확인 | 조회·댓글·재확인 | 지정된 `/reviews/:id` 응답·댓글·핀 | 불가 |
| 미팅 시간 조율(`/schedule/:pollId`) | 생성·응답·확정·취소 | 응답 | 지정된 조율 응답 | 불가 |
| G 단축키(`G+H/M/T/D` 등) | 활성 | 활성 | 비활성 (연구 없음) | 비활성 |

---

## 4. 화면별 기능 · 진입점 · 세부 인터랙션 · 상태 인벤토리

### 4-1. 공통 셸 (`WorkspaceShell`, `TopBar`, `SideRail`, `BottomDock`)
- **상단바(`TopBar.tsx`)**: 브랜드 로고(`/r/:id` 또는 `/r`), 연구 전환 드롭다운(`ResearchSwitcher`: 활성 연구 목록 + `모든 연구 보기` + `새 연구 만들기`), 주요 4메뉴(`홈`, `미팅`[미읽음 교수 응답 시 빨간 점], `할 일`, `글·자료` — hover 시 `navPreview` 툴팁 + 단축키), 검색 트리거(`이 연구에서 찾기 ⌘K`), 만들기 메뉴(`+` 드롭다운), 알림 벨(미읽음 점 + `Sheet`), 계정 메뉴(`ProfileDropdown` Kokonut 원본: 테마 3단 토글, 프로필/AI/사용량·플랜/사용 안내, `길게 눌러 로그아웃`, 하위 `Switch account` 뷰).
- **우측 사이드 창(`ia-panel-frame` + `PanelResizer`)**:
  - 폭 규칙(`lib/side-panel.ts`): `1200px` 미만 오버레이(화면 이동·외부 클릭 시 닫힘, 기억 안 함), `1200px` 이상 푸시 방식(기억함), `1440px` 이상 초기 기본 열림(기본 탭 `tasks`), 글 편집(W2)·자료 보기(W3)는 440px 폭 키 별도 저장, 드래그 리사이즈(312~640px).
  - 단축키 `]` 토글, 좌/우 위치 전환(`panel-side.ts`), `/tasks` 진입 시 `tasks` 패널이면 자동으로 `log` 탭으로 전환.
  - 4개 탭: `AssistantSidePanel`(도우미), `TasksPanel`(할 일), `LogPanel`(결정·질문), `MaterialsPanel`(자료 훑어보기) + 덮어쓰기 층 `ItemDetail`(`?detail=`).
- **우측 64px 아이콘 레일(`SideRail.tsx`)**: 상단 밀기 버튼(`≪/≫`), 4탭 버튼(`도우미`, `할 일`, `결정·질문`, `자료` — roving tabindex + ↑/↓ 방향키), 스페이서, 하단 `의견`(`mailto:admin@margin.com`), 사각 아이콘 묶음(`화면 배치` 드롭다운[오른쪽/왼쪽/너비 기본으로/화면 설정 모두 보기] + `설정` 톱니바퀴).
- **하단 도크(`BottomDock.tsx`)**: 녹음 진행 바(`MiniRecorder` 44px) + 모바일(≤767px) 5탭 바(`MobileTabBar`: 홈·미팅·할 일·글·자료·연구 도우미).
- **전역 모달/호스트**: `CommandPalette`(`⌘K`, 초성 검색 `es-hangul`), `ShortcutHelp`(`?`), `SettingsDialog`(`?settings=`), 알림 `Sheet`, `ResultCreateHost`, `ReviewCreateHost`, `FeedbackCreateHost`, `PollCreateHost`, `UploadQueueTray`.
- **전역 배너 우선순위(`ShellBanners`, 한 번에 1개)**: ① 새로고침 실패(`refreshError`) → ② 오프라인(`!navigator.onLine`) → ③ 보관한 연구(`archivedAt`) → ④ 미리보기 모드(`mode === "preview"`).

### 4-2. 연구 선택 · 온보딩 (R1 `/r`, R2 `/r/new`)
- **내 연구(`AuthPages.tsx`)**: 세그먼트 탭(`진행 중인 연구 / 완료된 연구 / 보관함 / 휴지통`), 열린 시간 조율 배너, 받은 초대 배너, 연구 카드(`연구 설정` 버튼 + `⋯`/우클릭 공통 메뉴: 열기·새 탭·설정·완료 표시·보관·휴지통), 휴지통 카드(`복원` + `PermanentResearchDelete`), `PendingResearchDeletions`(파일 삭제 잔여 작업 재시도).
  - 휴지통 이동 모달: 연구 이름 직접 입력 확인.
  - 완전 삭제 모달(`PermanentResearchDelete.tsx`): `SlideToConfirm`(밀어서 완전히 삭제, `confirmationName: name` 자동 전송).
- **연구 만들기(`OnboardingPage.tsx`)**: 최초 진입 시 소개 화면(`?intro=1`) + 4단계 위자드(1. 이름·설명·지도교수 이메일 → 2. 현재 단계 → 3. 다음 미팅·투고일 → 4. 연구 목적·질문) + 우측 실시간 홈 미리보기 + `건너뛰고 빈 연구로 시작` + 완료 시 `expandIntoHome` 전환.

### 4-3. 연구 홈 (H1 `/r/:id`, `HomePage.tsx`)
- **상단 헤더**: 연구 제목·설명 + `현재 단계 >` 칩 + `투고까지 D-N` 칩(`SubmissionCountdown`).
- **좌측 주 영역**:
  - 상황별 상단 알림 배너(예: 미정리 미팅 `"지난 미팅에서 나온 할 일을 아직 정리하지 않았어요."` + `[기록 정리하기]`, 교수 새 응답 등).
  - 다음 미팅 카드(일시·준비 현황·`[기록 열기]`·`[미팅 준비하기]`).
  - 하단 4탭 목록(`할 일`[인라인 추가·체크·되돌리기] · `알림` · `최근 미팅` · `최근 글·자료`).
- **우측 보조 영역**: 시작하기 체크리스트(`StartChecklist`, 4항목·숨기기), `연구 흐름` 카드(단계 진행 표시 + `열기 >`), `연구 방향` 카드(`ResearchDirection`: 목적·연구 질문 최대 5개·고치기).
- **상태**: 빈 홈(바로 시작 CTA), 뼈대 로딩(`HomeSkeleton`), 화면 안내 투어(`HomeTour`, `?tour=1`).

### 4-4. 미팅 · 서면 피드백 · 검토 · 시간 조율 (M1~M4)
- **미팅 목록(`RecordList.tsx`)**: `+ 기록 추가` 드롭다운(녹음 시작·서면 피드백 붙여넣기·파일에서 가져오기·다음 미팅 잡기·교수님께 검토 요청·시간 조율), 검색, 유형 필터(`전체` 등), 예정/월별 그룹, `취소한 미팅 보기` 체크박스, 우클릭/`⋯` 행 동작(`RowActions`).
- **미팅 상세(`MeetingsPage.tsx`, `RecordHeader.tsx`, `RecordSide.tsx`)**:
  - **준비 모드(`prepare`)**: 목표, 가져갈 할 일(넘어온 할 일 연결), 보여 줄 글·자료 버전, 물어볼 질문(드래그 정렬 `SortableList` + Alt+화살표).
  - **녹음 모드(`RecordingPanel.tsx`)**: 동의 확인 → 브라우저 음성 인식 실시간 전사(`live-speech.ts`), 파형(`voice-glow`), 일시정지, 무음 경고, 2시간 제한, `⌘⇧Enter` 지금 표시, 저장 전 검토.
  - **기록 완료 모드(`recorded`)**: 좌측 원문(전사/메모 0.8초 자동 저장, 충돌 비교, 3종 형광펜 `mark-kinds.ts`, 텍스트 드래그 선택 시 인라인 팝오버로 형광펜·피드백·결정·질문·할 일 생성) + 우측 열(AI 요약 `[정리하기]`, 피드백·할 일 목록, 결정, 질문).
- **교수 검토 상세(`ReviewDetailPage.tsx`)**: 상단 공유 상태·`새로고침`·`공유 설정`·`링크 복사`·`메일 알림 바`, 좌측 `검토 항목` 목록, 중앙 `수정 내용·파일`(PDF 뷰어 `PdfViewer.tsx` + 위치 핀 + `ColumnResizer`), 우측 `교수 응답`(수정 내용 확인 / 추가 수정 필요 + 이력) · `댓글`(답글·편집·삭제·해결), 모바일 2탭 전환.
- **시간 조율(`PollPage.tsx`, `AvailabilityGrid.tsx`)**: 가능 시간 셀 선택 그리드, 참여자별 가능 현황, 주최자 시간 확정/취소.

### 4-5. 할 일 · 피드백 (T1 `/r/:id/tasks`, `TasksHome.tsx`)
- **상단**: `할 일` 제목 + `+ 할 일 추가`, 2탭(`할 일` / `피드백`).
- **할 일 탭**: 주간 스트립(`WeekStrip`: 7일·점 표시·주 이동), 세그먼트(`남은 할 일 | 완료 | 전체 | 보관함`), 검색, 필터 2종(`우선순위`, `기록`), 그룹 목록(`기한 지남`, `이번 주`, `오늘 끝낸 할 일` 접기).
- **세부 인터랙션**: 체크박스 완료 + 6초 되돌리기 토스트 + `⌘Z` + 효과음(`ui-sound.ts`), 데스크톱 `⋯`/우클릭(`RowActions`), 모바일 스와이프(`swipe.ts`: 오른쪽 완료 / 왼쪽 내일로 미루기), 키보드 `J/K/Enter/X`.

### 4-6. 글·자료 · 원고 에디터 · PDF 뷰어 (W1~W3)
- **글·자료 목록(`DocsPage.tsx`, `MaterialFolders.tsx`)**: 좌측 분류(`전체 / 글 / 자료 / 폴더 트리 + / 보관함`), 상단 `[올리기 ▾]`(PDF 고르기·웹 링크 추가) + `[새 글]`, 검색·정렬, 넓은 화면 추가 열 표시(`#184`), 파일 드래그앤드롭 + 다중 업로드 확인 창 + 우하단 `UploadQueueTray`, 데스크톱 행→폴더 HTML 드래그, `RowActions`(열기·새 탭·이름/정보·폴더 이동·내려받기·보관).
- **열린 문서 탭 바(`OpenTabs.tsx`)**: 여러 글·자료를 탭으로 유지.
- **원고 에디터(`WritingPage.tsx`, `EditorToolbar.tsx`, `EditorGutter.tsx`, `WordDiff.tsx`)**: Tiptap 기반 서식 툴바, 1.5초 자동 저장 + `localStorage` 초안 복구 + 동시 편집 충돌 비교, 목차/정보 서랍, 버전 생성·단어 비교(`diff`)·슬라이더(`VersionCompareSlider`), AI 문장 점검(`WritingReview`)·인라인 고쳐쓰기·이어쓰기(`Tab/→/Esc`), 검토용 PDF 원클릭 생성(`document-pdf.tsx`), 우측 여백 연결 할 일/피드백(`EditorGutter`).
- **PDF 자료 상세(`MaterialsPage.tsx`, `MaterialView.tsx`, `PdfViewer.tsx`)**: PDF.js 렌더링, 페이지 이동, 확대/축소, 텍스트 보기(`pdf-text.ts`), 새 버전 올리기, 버전 목록, 다운로드, 사용된 기록 연결.

### 4-7. 연구 흐름 (F1 `/r/:id/flow`, `PlanningPage.tsx`)
- 2탭(`단계·주요 목표` / `달력`).
- **단계·주요 목표**: 3가지 보기(`시간순` 카드 / `월별` `MilestoneTimeline` / `관계도` `@xyflow/react` `RoadmapDiagram`), 기본 6단계로 시작, AI 일정 제안(`RoadmapProposal`), 균등 배분 초안, 주요 목표와 할 일·문서 연결.
- **달력**: `@fullcalendar/react` 월·주·목록 보기, 날짜 클릭 시 미팅 생성, 날짜 미정 미팅 목록.

### 4-8. 연구 도우미 · 설정 (P1, G1)
- **연구 도우미(`AssistantSidePanel.tsx`, `ResearchAssistant.tsx`)**: 3개 보기 탭(`대화 | 제안 | 실행 내역`), 대화 목록 드롭다운 + 새 대화, 빈 상태 추천 칩(`assistant-starters.ts`), Kokonut 입력창(`/` 명령 메뉴, 모델·깊이 선택 `AIModelSelector`, 파일 첨부, 음성 입력, 웹 검색 토글), 스트리밍·생각 단계(`AssistantThinking`), 답변 액션(`글로 저장`, `할 일 추가`, `복사`, `다시 답하기`), 하단 `AICreditStatus`(`내 잔액 · N크레딧`).
- **설정 모달(`SettingsDialog.tsx`, `SettingsPage.tsx`)**:
  - `내 계정` (6개): 프로필(이름·비밀번호), 화면(테마·언어 ko/ja·시간 12/24h·사이드 창 좌/우·효과음), 알림(4종 스위치), 연구 도우미(기본 모델·답변 깊이·도우미 이름/말투), 사용량·플랜(`UsageMeters`, `SubscriptionPlans`), 단축키(`ShortcutHelp`).
  - `이 연구` (4개): 연구 정보(이름·설명·목적·질문·투고일·키워드·인용양식·지도교수), 함께하는 사람(`ProjectInvites`), 미팅 주기(`MeetingCadenceSection`), 보관·삭제(보관/복원, 휴지통 이동).

---

## 5. 디자이너 18개 필수 검토 대상 ↔ 현재 코드·화면 위치 매핑 (팩트 정리)

> 아래 표는 **평가나 해결책 확정 없이**, 18개 필수 검토 대상이 실제 코드와 화면의 어디에 어떻게 구현되어 있는지 위치와 현재 동작만 매핑한 것입니다. (평가는 Phase 3, 개선안은 Phase 5에서 수행)

| # | 필수 검토 대상 | 실제 화면 위치 | 관련 코드 파일 | 현재 구현 사실 |
|---|---|---|---|---|
| 1 | 연구 전환기 하단 고정 & `새 연구 만들기` 위치 | 상단바 좌측 연구명 버튼 | `components/shell/TopBar.tsx` (`ResearchSwitcher`) | 연구 목록 + 구분선 + `모든 연구 보기` + `새 연구 만들기`가 하나의 스크롤 목록 안에 배치됨 |
| 2 | 홈 화면 정보 중복 & 일정/로드맵 역할 | `/r/:id` | `pages/HomePage.tsx`, `lib/side-panel.ts` | 홈 하단에 `할 일/알림/최근 미팅/최근 글·자료` 탭이 있고, 1440px+ 기본 열림 사이드 패널도 `tasks` 탭으로 열림 |
| 3 | 우측 사이드 레일 디자인·아이콘·하단 버튼 | 워크스페이스 우측 64px 레일 | `components/shell/SideRail.tsx`, `components/shell/shell.css`, `components/icons.tsx` | `disarto-icons-react` 단일 선형(stroke) 아이콘 사용. 하단에 `의견`(라벨 있음, `mailto:`) + `화면 배치`·`설정`(사각 배경 버튼 `ia-rail-square`) 배치 |
| 4 | 페이지 제목 크기·굵기 불일치 | `/r`, `/r/:id`, `/meetings`, `/tasks`, `/docs`, `/flow` | 각 페이지 CSS + `styles.css` | `/r`, `/tasks`, `/flow`는 `28px`, `/r/:id`, `/meetings`, `/docs`는 `20px`로 상이 |
| 5 | 휴지통 이동 vs 완전 삭제 마찰 구조 | `/r` 카드 메뉴 & 휴지통 탭 | `pages/AuthPages.tsx`, `components/PermanentResearchDelete.tsx` | 휴지통 이동은 연구명 직접 입력 확인, 완전 삭제는 `SlideToConfirm` 슬라이더 사용(`confirmationName: name` 자동 전달) |
| 6 | 휴지통 카드 `복원`·`완전히 삭제` 배치 | `/r?view=trash` | `pages/AuthPages.tsx`, `components/PermanentResearchDelete.tsx` | 카드 하단에 `복원` 버튼과 `ghost` 변형의 `🗑 완전히 삭제` 버튼이 인접 배치 |
| 7 | `SlideToConfirm` 드래그 마감·텍스트 겹침 | 완전 삭제 모달 | `components/SlideToConfirm.tsx` | 원형 썸 뒤 진행 채움 레이어와 중앙 라벨 텍스트가 겹쳐 렌더됨 |
| 8 | 모달 카피 길이 & `✕`/`취소` 중복 | 휴지통·완전 삭제 모달 등 | `components/PermanentResearchDelete.tsx`, `components/ui/dialog.tsx` | `DialogContent`의 `showCloseButton`(`✕`)과 `DialogFooter`의 `취소` 버튼이 동시 노출 |
| 9 | 홈 알림 카드 좌측 파란 띠 | `/r/:id` 상단 배너 | `pages/HomePage.tsx` | 카드 좌측에 파란 강조 선 스타일 적용 |
| 10 | `투고까지 D-N` 칩 텍스트 수직 정렬 | `/r/:id` 헤더 우측 | `components/home/SubmissionCountdown.tsx` | 칩 내부 텍스트 수직 정렬 미세 편차(Phase 2에서 픽셀 실측 예정) |
| 11 | `기록 정리하기` 등 UX 라이팅 | `/r/:id` 상단 배너 등 | `lib/home-action.ts`, `pages/HomePage.tsx` | 미정리 미팅 시 `"지난 미팅에서 나온 할 일을 아직 정리하지 않았어요."` + `[기록 정리하기]` 출력 |
| 12 | 연구 도우미 `제안`·`실행 내역` 탭 필요성 | 우측 사이드 창 `도우미` | `components/assistant/AssistantSidePanel.tsx`, `pages/ResearchAssistant.tsx` | 상단에 `대화 | 제안 | 실행 내역` 3탭 구조 구현 |
| 13 | 연구 도우미 빈 상태 추천 프롬프트 개수·맥락 | 우측 사이드 창 `도우미` 빈 상태 | `lib/assistant-starters.ts`, `pages/assistant/AssistantPanel.tsx` | 빈 상태에서 단일/제한적 추천 칩 노출 구조 |
| 14 | 잔액 크레딧 표기 (`19,190크레딧` vs `%`) | 연구 도우미 하단 & 설정 사용량 | `components/ai/AICreditStatus.tsx`, `pages/settings/UsageMeters.tsx` | `AICreditStatus.tsx`가 `formatCredits(credits.balance)`로 `"내 잔액 · {credits}크레딧"` 직접 출력 |
| 15 | 의견 수집(`mailto:` → 인앱/UT 수집) | 우측 레일 하단 `의견` | `components/shell/SideRail.tsx` (`FEEDBACK_MAIL`) | `<a href="mailto:admin@margin.com">` 외부 메일 링크로 구현 |
| 16 | 설정 화면 전반 완성도 | `?settings=*` 모달 | `components/settings/SettingsDialog.tsx`, `pages/SettingsPage.tsx`, `pages/settings/*` | 계정 6구획 + 연구 4구획 좌측 목록·우측 상세 모달 구조 |
| 17 | 공개 랜딩/소개 페이지 완성도 | `/`, `/features`, `/pricing` | `pages/PublicPages.tsx`, `components/marketing/*` | `CloudShader`, `WorkflowStack`, `MarketingEffects` 기반 공개 페이지 |
| 18 | 선행 독립 검수 주요 결함 목록 | 전 화면 | `styles.css:84`(`scrollbar-gutter`), `ReviewDetailPage.tsx`, `DocsPage.tsx`, `WritingPage.tsx`, `WorkspaceShell.tsx` | MA-01(11px 거터), MA-08(알림 모달), MA-09(대비), MA-15(계정 메뉴), MA-20(검토 PDF), MA-21(320 에디터), MA-22/24(시간 조율), MA-23(모바일 글·자료) 등 |

---

## 6. 공통 컴포넌트 · 라이브러리 · 스타일 계층 구조

### 6-1. 핵심 외부 라이브러리 (`apps/home-preview/package.json`)
| 분류 | 패키지 | 사용처 |
|---|---|---|
| 프레임워크 · 상태 | `react` 19.2, `react-router-dom` 7.18, `@tanstack/react-query` 5.105, `@supabase/supabase-js` 2.118 | 전역 라우팅, 서버 캐시, 인증/RPC |
| UI 기반 · 디자인 시스템 | `@montage-ui/core` 4.2, `@montage-ui/icon` 4.2, `radix-ui` 1.8, `@base-ui/react` 1.9, `@floating-ui/react` 0.27, `tailwindcss` 4.3, `@emotion/react` 11.14 | 토큰·버튼·다이얼로그·드롭다운·팝오버 |
| 모션 · 인터랙션 | `motion` 14.9, `@formkit/auto-animate` 0.10, `@number-flow/react` 0.6, `sonner` 2.0, `cmdk` 1.1, `react-hotkeys-hook` 5.3, `react-dropzone` 20.2, `voice-glow` 0.3 | 스와이프, 리스트 전환, 숫자 롤링, 토스트, ⌘K, 단축키, 드롭존, 음성 파형 |
| 아이콘 | `disarto-icons-react` 1.0 (주 아이콘 63종, `components/icons.tsx`), `lucide-react` 1.67 (Kokonut 등 일부) | 선형(stroke) 위주 아이콘 혼용 |
| 에디터 · 문서 · 시각화 | `@tiptap/react` 3.32, `pdfjs-dist` 6.5, `@react-pdf/renderer` 4.9, `react-compare-slider` 4.0, `diff` 9.0, `@fullcalendar/react` 7.1, `@xyflow/react` 12.12, `es-hangul` 2.4 | 원고 편집, PDF 뷰/생성, 버전 비교, 달력, 관계도, 한글 초성 검색 |

### 6-2. 자체 공통 UI 및 Kokonut 원본 범위
- **Kokonut 원본 유지 컴포넌트 (`components/kokonut/`, 18개)**: `profile-dropdown`, `ai-prompt`, `ai-model-selector`, `ai-attachment`, `ai-autocomplete`, `ai-citations`, `ai-context-meter`, `ai-handoff`, `ai-inline-edit`, `ai-input-search`, `ai-loading`, `ai-message-queue`, `ai-schedule`, `ai-send`, `ai-tool-calls`, `ai-voice`, `clip-trimmer`, `switch-button`.
- **자체 공통 부품**: `RowActions`(우클릭·`⋯`·스와이프 공통화, `#184`), `SideRail`, `TopBar`, `BottomDock`, `PanelResizer`, `SettingsDialog`, `CommandPalette`, `ItemDetail`, `SlideToConfirm`, `PdfViewer`, `VersionCompareSlider`, `SortableList`, `UploadQueueTray`.
- **CSS 계층 (`src/design/`)**: `layers.css` (`@layer margin`), `tokens.css`, `montage.css`, `styles.css` (`html { scrollbar-gutter: stable }` 84행), 화면별 CSS(`shell.css`, `record-*.css`, `settings-dialog.css`, `tasks.css`, `row-actions.css` 등).

---

## 7. 데이터 모델 및 연결 구조 (`lib/domain.ts`, `lib/workspace-contract.ts`)

### 7-1. 29개 엔티티 관계 요약 (`WorkspaceData`)
- **최상위 축**: `Research` (`id`, `ownerId`, `name`, `description`, `purpose`, `questions[]`, `advisorEmails[]`, `submissionDate`, `keywords[]`, `citationStyle`, `meetingCadence`, `currentPhaseId`, `nextMeetingId`, `completedAt`, `archivedAt`, `deletedAt`)
- **협업·알림**: `ResearchMember`(`owner`/`editor`), `ActivityEvent`, `MeetingPoll`(시간 조율 → 확정 시 `meetingId` 연결)
- **미팅·녹음·기록**: `Meeting`(`meeting` | `written`, `memoMarks[]`, `summary`, `taskIds[]`, `versionIds[]`, `documentIds[]`, `questionIds[]`) ← `Recording`(`segmentTimes[]`, `transcriptMarks[]`)
- **피드백·실행 루프**: `Feedback`(`meetingId`, `audioSource`, `status` 5종) ← `RevisionPlan`(수정 방법) ← `Task`(`feedbackIds[]`, `planId`, `sourceRecordId`, `documentId`, `sectionAnchor`, `phaseId`, `dueDate`, `priority`, `status` 3종) · `Decision`(`meetingId`, `replacesId`) · `Question`(`meetingId`, `status`)
- **문서·자료·폴더**: `MaterialFolder`(`parentId` 계층) ← `DocumentRecord`(`plan`/`manuscript`/`note`, `origin`, `draftedFrom[]`) ← `DocumentVersion` / `Material`(`type`, `typeExplicit`, `sourceDocumentId`) ← `MaterialVersion`(`storagePath`, `textExtraction`)
- **검토 루프**: `RevisionResult`(`feedbackIds[]`, `taskIds[]`, `versionId`, `location`) → `ReviewRequest`(`shared`/`stopped`) ← `ReviewItem` ← `ReviewRound`(차수별 스냅샷) ← `ReviewResponse`(`confirmed` | `changes_requested`) · `ReviewComment`(스레드·`resolved`·소프트 삭제) · `ReviewRead`
- **일정·로드맵**: `ResearchPhase`(`order`, `startDate`, `dueDate`, `dependsOn[]`, `position`) ← `Milestone`(`phaseId`, `taskIds[]`, `documentIds[]`)
- **AI**: `AIConversation`(`messages[]`, `contexts[]`) · `Attachment` · `SavedAICandidate`(`pending`/`adopted`/`dismissed`) · `AIRun`(`running`/`complete`/`failed`/`cancelled`)

### 7-2. 핵심 상태 분리 원칙 및 클라이언트 저장 키
- **5개 독립 상태**: ① 할 일 완료(`Task.status`) ② 수정 결과 제출(`RevisionResult`) ③ 교수 응답(`ReviewResponse.result`) ④ 댓글 해결(`ReviewComment.resolved`) ⑤ 읽음(`ReviewRead.lastSeenAt` / `ActivityEvent.readAt`) — 서로 자동 전이되지 않음.
- **브라우저 저장(`localStorage`)**: 사이드 창 열림(`margin-panel-open`), 마지막 탭(`margin-panel-tab`), 패널 폭(`PANEL_WIDTH_KEY` / `DOCS_PANEL_WIDTH_KEY`), 모바일 층 세그먼트(`margin-phone-layer`), 사이드 창 위치(`panel-side`), 원고/메모 로컬 초안 복구(`writing-draft.ts`).
