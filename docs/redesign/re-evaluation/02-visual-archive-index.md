# MARGIN Phase 2 — 실제 화면·세부 상태·인터랙션 심층 검수 아카이브 인덱스

- **작성일**: 2026-11-25
- **검증 기준**:
  - **라이브 배포**: `margin-research.pages.dev` (Chrome 원격 디버깅 포트 `127.0.0.1:9222`, 학생 계정 `student@margin.com` + 교수·공동연구자 계정 `professor@margin.com` 전환 실검증, 운영 DB 변경 0건)
  - **로컬 코드 기준**: `Margin-repo` HEAD `4fce15e` (`#184`, 미커밋 4개 파일 원본 보존)
  - **로컬 격리 환경**: Vite 미리보기 (`127.0.0.1:4181`, 검수 후 종료)
- **수집 증거 총량**: **총 150개 파일** (`assets/` 하위 9개 디렉토리, 기존 85개 + 심층 45개 + 교수·공동연구자 20개)
  - `live-desktop/` 44개 · `live-desktop-deep/` 45개 · `live-professor-editor/` 20개 (PNG 18 + JSON 2) · `live-mobile/` 19개 · `dark-mode/` 5개 · `motion/` 7개 · `isolated-local/` 2개 · `benchmarks/` 5개 · `metrics/` 3개
- **검증 환경 범례**: `[라이브]` 실제 배포 화면 조작 및 육안 확인 / `[로컬 격리]` 상태 변경이 필요한 인터랙션을 격리 환경에서 확인 / `[코드 확인]` 코드 분기·핸들러 확인 / `[미검증]` 계정·권한·유료 API·실기기 제약으로 미실행

---

## 1. 코드베이스 전수 탐색 결과 (Phase 1 제품 지도 대비 심층 발굴)

`apps/home-preview/src/**` 전체를 스캔하여 라우트 단위 외에 버튼·이벤트·조건부 렌더링으로 노출되는 내부 UI를 전수 추출했다.

| 분류 | 식별 규모 | 핵심 코드 경로 예시 |
|---|---|---|
| 모달·팝오버·드롭다운·슬라이더·리사이저 | **57개 파일** | `SlideToConfirm.tsx`, `TopBar.tsx`, `CommandPalette.tsx`, `GlobalCreateDialog.tsx`, `ReviewShareDialog.tsx`, `RecheckDialog.tsx`, `CompareView.tsx`, `SlashCommandMenu.tsx`, `ModelSelector.tsx` |
| 모션·마이크로 인터랙션 컴포넌트 | **42개 파일** | `motion/react` (`AnimatePresence`), `@formkit/auto-animate`, `NumberFlow`, `DrawnCheck`, `RollingNumber`, `SwipeableRow`, `PanelResizer` |
| 역할·권한·조건부 분기 UI | **25+개 파일** | `owner` vs `editor` (`ResearchSettings`, `PeopleTab`, `DangerTab`), `student` vs `professor` (`IncomingReviews`, `ReviewDetail`, `SchedulePoll`), `empty` 온보딩 체크리스트 |

### 주요 계측 수치 요약 (`assets/metrics/batch1_live.json`, `batch2_live.json`, `batch3_live.json`)
- **페이지 제목(`h1`) 타이포그래피 불일치**: `/tasks`·`/flow` `28px / 700`, `/r/:id` 홈 `20px / 700`, `/docs` `20px / 400`, `/meetings` `h1` 없음.
- **우측 `SideRail` 버튼 크기 비대칭**: 상단 5개(`도우미·할 일·결정·질문·자료·의견`) `60×58px`, 하단 2개(`화면 배치·설정`, `ia-rail-square`) `32×32px`.
- **라이브 `/reviews/:id` PDF 캔버스**: 우측 패널 닫힘 기준 `504×652px` 실측.

---

## 2. 영역별 기능 × 세부 상태 심층 검수 매트릭스

### A. 연구 선택 및 관리 (`/r`, 카드 메뉴, 휴지통·삭제)

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| A1 | `/r` | 진행 중인 연구 7개 (긴 제목·일반·빈 연구) | 페이지 진입 | `[라이브]` | `pages/ResearchListPage.tsx` | **정상**: 카드 그리드·상태 배지·하단 메타 정렬 깔끔. **이슈**: 상단 `+ 연구 만들기` CTA와 세그먼트 탭 여백, 긴 QA 제목 카드 2줄 말줄임 확인. | `live-desktop/01_r_active_1440.png` |
| A2 | `/r` → 카드 `⋯` | 카드 컨텍스트 메뉴 | `⋯` 버튼 클릭 | `[라이브]` | `components/research/ResearchCard.tsx` | **정상**: 보관·휴지통 이동 항목 명확. **이슈**: 카드 하단에 `연구 설정`과 `⋯`가 나란히 놓여 시각적 무게 균형 검토 필요. | `live-desktop/04_research_card_menu_1440.png` |
| A3 | `/r` → `휴지통` 탭 | 휴지통 연구 16개 | 탭 클릭 | `[라이브]` | `pages/ResearchListPage.tsx` | **이슈**: `복원`과 `완전히 삭제` 버튼이 인접해 있고 `완전히 삭제`가 회색 톤이라 위험 액션 위계가 약함(사용자 18개 문제의식 확인). | `live-desktop/02_r_trash_1440.png` |
| A4 | `/r` 휴지통 → `완전히 삭제` | 영구 삭제 확인 모달 + `SlideToConfirm` | 버튼 클릭 → 25%/50%/72% 드래그 후 해제 | `[라이브]` | `components/common/SlideToConfirm.tsx` | **이슈**: 모달 상단 `✕`와 하단 `취소` 중복, 안내문 3줄 장문, 슬라이드 진행 중 원형 핸들 뒤 채움 영역 끝단이 직선으로 끊기고 배경 라벨(`밀어서 완전히 삭제`)이 겹쳐 보임. | `live-desktop/03_modal_permanent_delete_1440.png`, `motion/slide_delete_25.png`, `motion/slide_delete_50.png`, `motion/slide_delete_72.png` |

### B. 글로벌 셸·탐색·검색·생성 모달

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| B1 | TopBar 좌측 연구명 | 연구 전환 드롭다운 | 드롭다운 클릭 | `[라이브]` | `components/shell/TopBar.tsx` | **이슈**: 긴 연구명이 드롭다운 내부에서 3줄로 줄바꿈되고 하단 `모든 연구 보기` 접근성·시인성 개선 여지 확인. | `live-desktop/07_research_switcher_1440.png` |
| B2 | TopBar 상단 탭 | `미팅` 탭 호버 프리뷰 툴팁 | 마우스 호버 | `[라이브]` | `components/shell/TopBar.tsx` | **정상·우수**: `미팅 · G M · 다음 미팅 · 날짜 미정` 형태로 단축키와 컨텍스트를 간결하게 안내. | `live-desktop-deep/d37_topbar_nav_hover_hint.png` |
| B3 | TopBar `+` 버튼 | 글로벌 생성 메뉴 및 `?new=` 6종 모달 | `+` 클릭 및 각 모달 오픈 | `[라이브]` | `components/shell/GlobalCreateDialog.tsx` | **정상·우수**: 서면 기록·미팅·일정 조율·검토 요청·피드백·결과 등록 6종 모두 정상 렌더링. 특히 `검토 요청` 모달은 `개인 메모·할 일·AI 대화 미포함` 프라이버시 고지가 명확함. | `live-desktop/08_create_menu_1440.png`, `live-desktop-deep/d11_dialog_new_written.png`, `d11_dialog_new_meeting.png`, `d11_dialog_new_poll.png`, `d11_dialog_new_review.png`, `d11_dialog_new_feedback.png`, `d11_dialog_new_result.png` |
| B4 | `⌘K` 커맨드 팔레트 | 기본·한글 초성(`ㅁㅌ`)·결과 없음(`zzzzz999`) | `⌘K` 입력 및 검색어 입력 | `[라이브]` | `components/shell/CommandPalette.tsx` | **정상·우수**: 한글 초성 `ㅁㅌ` 검색이 즉각 미팅 항목을 매칭하며, 빈 상태에서도 `'zzzzz999'와 맞는 항목이 없어요.` 안내가 자연스러움. | `live-desktop/32_command_palette_1440.png`, `live-desktop-deep/d38_cmdk_chosung_search.png`, `live-desktop-deep/d39_cmdk_empty_state.png` |
| B5 | TopBar 알림·계정 / SideRail 배치 | 알림 팝오버, 계정 메뉴, 화면 배치 팝오버 | 각 아이콘 클릭 | `[라이브]` | `components/shell/TopBar.tsx`, `SideRail.tsx` | **정상**: 각 팝오버 열림·닫힘 안정적. **이슈**: SideRail 상단(`60×58px`)과 하단(`32×32px`) 크기 비대칭. | `live-desktop/09_notifications_1440.png`, `10_account_menu_1440.png`, `11_rail_layout_menu_1440.png` |

### C. 연구 홈 (`/r/:id`)

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| C1 | `/r/:id` (일반·긴 제목) | 1440px(패널 열림/닫힘), 1280px | 페이지 진입·패널 토글 | `[라이브]` | `pages/ResearchHomePage.tsx` | **이슈**: 상단 액션 배너 좌측 파란 띠, `기록 정리하기` 문구 모호성, `투고까지 D-83` 칩 수직 정렬 미세 어긋남, 우측 도우미 초기 칩이 홈에서는 1개만 노출됨. | `live-desktop/06_home_long_1440.png`, `14_home_main_1440.png`, `15_home_panel_closed_1440.png`, `16_home_main_1280.png` |
| C2 | `/r/:emptyId` | 빈 연구 홈 (`R2 업로드 테스트`) | 페이지 진입 | `[라이브]` | `pages/ResearchHomePage.tsx` | **정상·우수**: `시작하기 1 / 4` 온보딩 체크리스트와 진행률 바가 깔끔하게 구성되어 첫 진입 안내가 명확함. | `live-desktop-deep/d40_empty_research_home.png` |

### D. 항목 상세 패널 (`?detail=`) 및 우측 사이드 패널

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| D1 | `?detail=task:...` | 할 일 상세 패널 | 항목 클릭 | `[라이브]` | `components/detail/ItemDetailPanel.tsx` | **정상**: 상태·우선순위·마감일·연결 항목 한곳에서 편집 가능. **이슈**: `진행 중`, `높음`, `고르지 않음`, `고르기`가 브라우저 기본 `<select>` 화살표로 노출되어 디자인 시스템과 이질감 발생. | `live-desktop-deep/d01_itemdetail_task.png` |
| D2 | `?detail=feedback:...` | 피드백 상세 (음성 클립 구간 포함) | 피드백 항목 클릭 | `[라이브]` | `components/detail/ItemDetailPanel.tsx` | **이슈**: 312px 패널 폭에서 오디오 클립 트리머 타임라인 라벨(`90s105s120s135s150s`)이 서로 겹쳐 충돌함. 상단 진행 도트 5개에 텍스트 라벨이 없어 단계 의미가 즉각 파악되지 않음. | `live-desktop-deep/d02_itemdetail_feedback.png` |
| D3 | SideRail `결정·질문` / `자료` | 결정·질문 목록·상세(`?detail=`), 자료 사이드패널 | 레일 아이콘 및 항목 클릭 | `[라이브]` | `components/side-panel/DecisionsPanel.tsx`, `MaterialsPanel.tsx` | **정상**: 목록에서 항목 클릭 시 즉시 상세 패널로 전환되고 뒤로가기로 복귀. | `live-desktop-deep/d03_sidepanel_decisions.png`, `d04_itemdetail_decision.png`, `d06_sidepanel_materials.png` |

### E. 미팅 (`/meetings`)

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| E1 | `/meetings` | 목록·상세·`+` 추가 메뉴 | 탭 진입·항목 선택·메뉴 클릭 | `[라이브]` | `pages/MeetingsPage.tsx` | **정상**: 좌측 목록 + 우측 상세 2단 분할 구조 안정적. **이슈**: 페이지 `h1` 부재. | `live-desktop/17_meetings_list_1440.png`, `18_meetings_add_menu_1440.png`, `19_meeting_detail_1440.png` |
| E2 | `/meetings` → 녹음 미팅(`제5차 논문 지도`) | 음성 플레이어·전사·AI 요약 | 미팅 선택·전사 스크롤 | `[라이브]` | `components/meetings/MeetingAudioCard.tsx`, `TranscriptView.tsx` | **정상**: 음성 재생바·화자별 전사·AI 요약 구조 충실. **이슈**: 음성 녹음 카드 우측 끝의 `음성 공유` 텍스트가 카드 우측 경계에서 잘림. | `live-desktop-deep/d07_meeting_recorded_audio.png`, `d08_meeting_transcript.png` |
| E3 | `/meetings` → 서면 피드백 | 카카오톡 서면 피드백 기록 | 항목 선택 | `[라이브]` | `components/meetings/WrittenRecordView.tsx` | **정상**: 출처(카카오톡)·내용·연결 피드백 정리 깔끔. | `live-desktop-deep/d10_meeting_written_kakao.png` |
| E4 | `/r/:emptyId/meetings` | 기록 0건 빈 상태 | 페이지 진입 | `[라이브]` | `pages/MeetingsPage.tsx` | **이슈**: 좌측 목록이 0건인데도 우측 빈 상태 안내가 `"왼쪽 목록에서 기록을 고르거나 새 기록을 추가해 주세요."`로 표시되어 모순됨. | `live-desktop-deep/d42_empty_research_meetings.png` |

### F. 할 일 & 피드백 (`/tasks`)

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| F1 | `/tasks` | 할 일 목록·피드백 탭·빈 연구 할 일 | 탭 전환 및 빈 연구 진입 | `[라이브]` | `pages/TasksPage.tsx` | **정상**: 28px/700 제목 위계 선명, 피드백 연동 탭·빈 상태 안내 정상. | `live-desktop/20_tasks_1440.png`, `21_tasks_feedback_1440.png`, `live-desktop-deep/d41_empty_research_tasks.png` |
| F2 | `/tasks` (격리 환경) | 할 일 완료 체크 + 되돌리기 토스트 | 체크박스 클릭 | `[로컬 격리]` | `components/tasks/TaskRow.tsx` | **정상**: 체크 애니메이션(`DrawnCheck`) 및 하단 되돌리기 토스트 정상 표시. | `isolated-local/01_task_done_toast_1440.png` |

### G. 글·자료 & 원고 에디터 & PDF (`/docs`)

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| G1 | `/docs` | 목록·우클릭 메뉴·업로드 메뉴·3단 미리보기(`👁`) | 각 메뉴 클릭·`👁` 토글 | `[라이브]` | `pages/DocsPage.tsx` | **정상**: 우클릭 컨텍스트 메뉴와 업로드 드롭다운 깔끔. **이슈**: `👁` 미리보기 패널을 열면 넓은 화면 테이블 메타 열이 2줄 행으로 접히며, `/docs` 제목이 `20px / 400`으로 타 페이지 대비 약함. | `live-desktop/22_docs_list_1440.png`, `23_docs_context_menu_1440.png`, `24_docs_upload_menu_1440.png`, `live-desktop-deep/d12_docs_3col_preview.png` |
| G2 | `/docs` → 새 글 / 새 폴더 / 파일 드롭 | 빈 제목 유효성 검증·새 폴더·다중 드롭 스테이징 | 빈 제출·모달 오픈·격리 드롭 | `[라이브]` / `[로컬 격리]` | `components/docs/NewDocDialog.tsx`, `StagingUploadDialog.tsx` | **정상**: 새 글 빈 제목 제출 시 인라인 유효성 메시지 정상 작동. 격리 환경 다중 파일 스테이징 다이얼로그 정상. | `live-desktop-deep/d13_dialog_new_doc_validation.png`, `d14_dialog_new_folder.png`, `isolated-local/02_docs_staging_dialog_1440.png` |
| G3 | `/docs/:id` (원고 에디터) | 본문 편집·버전 메뉴·글 검토 요청·`CompareView` (`WordDiff`) | 문서 진입·버전 드롭다운·비교 실행 | `[라이브]` | `pages/WritingEditorPage.tsx`, `components/docs/CompareView.tsx` | **정상·우수**: `v1(11월 18일)와 지금` 단어 비교(`WordDiff`)와 `단어 비교 \| 슬라이더` 전환, AI 컨텍스트 칩(`학위논문 2장 이론적 배경 · 문서`) 자동 연결 우수. **이슈**: Montage UI 드롭다운 내부 `<div data-component="with-interaction">` 오버레이가 내부 `<span>` 포인터 이벤트를 가로챔. | `live-desktop/25_writing_editor_1440.png`, `live-desktop-deep/d15_editor_manuscript.png`, `d16_editor_versions_menu.png`, `d17_editor_writing_review_dialog.png`, `d18_editor_compare_worddiff.png` |
| G4 | `/docs/:id` (PDF 자료) | PDF v1/v2 상세·텍스트 추출·새 버전 업로드 | PDF 진입·`이 페이지 텍스트 보기`·새 버전 클릭 | `[라이브]` | `pages/MaterialDetailPage.tsx` | **정상·우수**: 한글 표 포함 PDF 렌더링 선명, `이 페이지 텍스트 보기` 추출 정확, 우측 AI 도우미가 PDF 컨텍스트 맞춤 시작 칩 3개를 제공(홈 1개 대비 우수). | `live-desktop/26_material_pdf_1440.png`, `live-desktop-deep/d19_pdf_v2_detail.png`, `d20_pdf_text_view.png`, `d21_dialog_pdf_new_version.png` |

### H. 연구 도우미 (AI 사이드 패널)

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| H1 | 우측 `도우미` 패널 | 대화·제안·실행 내역 탭 | 탭 전환 | `[라이브]` | `components/assistant/AssistantSidePanel.tsx` | **정상**: 3개 탭 전환 및 실행 이력 카드 구조 명확. | `live-desktop/12_assistant_chat_1440.png`, `13_assistant_suggestions_1440.png`, `13_assistant_runs_1440.png` |
| H2 | 도우미 헤더 & 입력창 | 대화 기록 드롭다운·`/` 8종 슬래시 메뉴·Gemini 4모델 선택 | 드롭다운 클릭·`/` 입력·모델 버튼 클릭 | `[라이브]` | `SlashCommandMenu.tsx`, `ModelSelector.tsx` | **정상·우수**: `/` 입력 시 8개 명령어와 키보드 힌트 즉시 노출, 4개 Gemini 모델 선택 팝오버 깔끔. | `live-desktop-deep/d22_assistant_history_menu.png`, `d23_assistant_slash_commands.png`, `d24_assistant_model_selector.png` |

### I. 검토 요청 (`/reviews/:id`)

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| I1 | `/reviews/:id` | 상세·공유 설정·재확인 요청·응답 기록 | 페이지 진입 및 각 버튼 클릭 | `[라이브]` | `pages/ReviewDetailPage.tsx`, `ReviewShareDialog.tsx`, `RecheckDialog.tsx` | **정상·우수**: 재확인 요청 다이얼로그의 명시적 확인 체크박스와 응답 기록 타임라인 명확. **이슈**: `공유 설정` 다이얼로그 내부에 `SlideToConfirm`(`밀어서 공유 중지`)이 `✕`·`취소`·`설정 저장`과 혼재되어 조작 복잡도 높음. | `live-desktop/30_review_detail_1440.png`, `live-desktop-deep/d26_review_share_dialog.png`, `d27_review_recheck_dialog.png`, `d28_review_response_history.png` |

### J. 연구 흐름 & 일정 조율 (`/flow`, `/schedule/:pollId`)

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| J1 | `/flow` | 카드 뷰·캘린더 뷰·단계 추가 다이얼로그 | 탭 전환·`+ 단계 추가` 클릭 | `[라이브]` | `pages/FlowPage.tsx`, `AddPhaseDialog.tsx` | **정상**: 28px/700 제목, 카드·캘린더 전환 및 단계 추가 폼 깔끔. | `live-desktop/27_flow_cards_1440.png`, `28_flow_calendar_1440.png`, `live-desktop-deep/d36_dialog_add_phase.png` |
| J2 | `/schedule/:pollId` | 일정 조율 상세 (학생 뷰) | 페이지 진입 | `[라이브]` | `pages/SchedulePollPage.tsx` | **정상**: 후보 시간대 선택 그리드와 상태 표시 명확. | `live-desktop/29_schedule_poll_1440.png` |

### K. 설정 10개 탭 (`/settings`)

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| K1 | `/settings` | 프로필·연구·참여자·일정·도우미·화면·알림·단축키·사용량·위험 10탭 전수 | 좌측 탭 순차 클릭 | `[라이브]` | `pages/SettingsPage.tsx` | **정상**: 10개 탭 모두 레이아웃 깨짐 없이 전환. `위험` 탭 휴지통 이동·영구 삭제 구조와 `사용량` 크레딧 그래프 확인 완료. | `live-desktop/31_settings_profile_1440.png`, `31_settings_research_1440.png`, `31_settings_people_1440.png`, `31_settings_schedule_1440.png`, `31_settings_assistant_1440.png`, `31_settings_display_1440.png`, `31_settings_notifications_1440.png`, `31_settings_shortcuts_1440.png`, `31_settings_usage_1440.png`, `31_settings_danger_1440.png` |

### L. 온보딩 (`/r/new`) 및 공개·안내·404 페이지

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| L1 | `/r/new?intro=1` | 인트로 + 1~4단계 (생성 미실행) | 다음 버튼 순차 진행 | `[라이브]` | `pages/NewResearchOnboardingPage.tsx` | **정상**: 단계 진행 바·입력 폼·우측 미리보기 카드 정상 작동. | `live-desktop-deep/d29_onboarding_intro.png`, `d30_onboarding_step1.png`, `d31_onboarding_step2.png`, `d32_onboarding_step3.png`, `d33_onboarding_step4.png` |
| L2 | `/`, `/features`, `/pricing`, `/guide`, `/privacy`, `/404` | 공개 마케팅·가이드·개인정보·커스텀 404 | 페이지 진입 | `[라이브]` | `pages/public/**`, `NotFoundPage.tsx` | **정상**: 데스크톱 1440px 기준 모든 공개 페이지 및 커스텀 404 정상 표시. | `live-desktop/33_public_landing_1440.png`, `33_public_features_1440.png`, `33_public_pricing_1440.png`, `live-desktop-deep/d43_public_guide.png`, `d44_public_privacy.png`, `d45_not_found_404.png` |

### M. 모션·마이크로 인터랙션 연속 프레임 & 반응형·다크 모드·벤치마크

| 구분 | 범위 | 검증 | 육안 확인 요약 | 증거 파일 |
|---|---|---|---|---|
| **모션 프레임 (7개)** | 영구 삭제 슬라이더 25/50/72%, 모바일 할 일 스와이프 0/90px, 사이드 패널 리사이즈 450/600px | `[라이브]` / `[로컬 격리]` | 슬라이더 채움 끝단 직선 끊김·라벨 겹침 확인; 패널 리사이즈 450→600px 부드럽게 추적; 모바일 스와이프 90px 액션 노출 확인. | `motion/slide_delete_25.png`, `slide_delete_50.png`, `slide_delete_72.png`, `swipe_task_00.png`, `swipe_task_90px.png`, `panel_resize_450.png`, `panel_resize_600.png` |
| **반응형 (19개)** | 홈·미팅·할 일·글·자료(1024/768/390/320px), 공개 3종(320px) | `[라이브]` | 390/320px에서 하단 탭 전환 정상, 일부 좁은 폭 밀집 구간 식별 완료. | `live-mobile/home_{1024,768,390,320}.png`, `meetings_{1024,768,390,320}.png`, `tasks_{1024,768,390,320}.png`, `docs_{1024,768,390,320}.png`, `public_{landing,features,pricing}_320.png` |
| **다크 모드 (5개)** | `/r` 휴지통, 홈, 할 일, 글·자료, 설정 사용량 (1440px) | `[라이브]` | 전반적 대비 양호, 일부 보조 테두리·배지 대비는 Phase 3에서 정밀 평가 예정. | `dark-mode/dark_r_trash_1440.png`, `dark_home_1440.png`, `dark_tasks_1440.png`, `dark_docs_1440.png`, `dark_settings_usage_1440.png` |
| **벤치마크 (5개)** | Toss, Modulify, Manyfast, Liner, Opensurvey (참고용) | `[라이브]` | 필요 시 Phase 5에서 선택적 참고 자료로 보관. | `benchmarks/ref_{toss_im,modulify,manyfast,liner,opensurvey}.png` |

### N. 교수 계정 및 공동연구자(`editor`) 권한·역할 심층 검수 (`professor@margin.com`, +20개 파일)

| ID | 진입 경로 | 상태 / 조건 | 조작 방식 | 검증 | 관련 코드 경로 | 육안 확인 결과 (정상·우수 + 이슈) | 증거 파일 |
|---|---|---|---|---|---|---|---|
| N1 | `/login` → `/r` | 교수 로그인 및 `/r` 메인 (`받은 검토 요청` + 일정 조율 + 공동연구) | 로그아웃 후 `professor@margin.com` 로그인 | `[라이브]` | `pages/LoginPage.tsx`, `pages/ResearchListPage.tsx` | **정상**: 수신 검토 요청 2건(학생명·연구명·항목 수·날짜·`모두 응답함`), 일정 조율 배너, 참여 중인 공동연구 1건이 순서대로 노출. **이슈**: 교수 계정임에도 우상단 `+ 연구 만들기` 파란 CTA가 그대로 강조되며, 공동연구 카드의 `미팅 0개`는 비공개 미팅 격리 때문이나 안내가 없음. | `live-professor-editor/p00_login_screen.png`, `p01_prof_r_home.png` |
| N2 | `/r` 알림 아이콘 | 교수 알림 모달 (`읽지 않음 10`) | 알림 버튼 클릭 | `[라이브]` | `components/shell/NotificationModal.tsx` | **정상·우수**: `검토 알림 빼고 모두 읽음` 안전장치 문구가 실용적. **이슈**: 부제가 `"교수 응답과 댓글, 담당 할 일..."`로 학생 시점 문구가 교수 화면에도 그대로 노출됨. | `live-professor-editor/p03_prof_notifications.png` |
| N3 | `/reviews/0994717f-...` | **단독 교수 검토 요청** (`X2`, 편집자 권한 없음) | 수신 검토 카드 클릭 | `[라이브]` | `pages/ReviewDetailPage.tsx` | **정상·우수**: 학생 워크스페이스 상단 탭·우측 레일 없이 전용 간소 헤더(`← 받은 검토 요청`, `새로고침`, 아바타)와 3단 검토 레이아웃(`검토 항목`·`수정 내용+PDF`·`교수 응답`)이 깔끔하게 구성됨. | `live-professor-editor/p09_prof_only_review_detail.png`, `_prof_only_review.json` |
| N4 | `/reviews/d9e66d11-...` | **교수+편집자 겸임 검토 요청** (응답 UI·핀 찍기·모바일 390px) | 수신 검토 진입 → `추가 수정 필요`·`PDF 위치 핀 찍기`·390px 전환 | `[라이브]` | `pages/ReviewDetailPage.tsx` | **중요 이슈(역할 충돌)**: 교수가 해당 연구의 공동연구자(`편집자`)를 겸하는 경우, 학생 발신 UI(`공유 설정`, `링크 복사`, `교수님께 메일로도 알리기`, `다시 확인 요청`, `수정 결과에서 고치기 →`)와 교수 수신 UI(`내가 남긴 응답`, `내 응답 변경`)가 한 화면에 동시 노출됨. 또한 `p06`에서 삭제된 댓글(`"삭제한 댓글이에요."`) 아래에도 `답글`·`해결로 표시` 버튼이 활성 상태로 남아 있음. **정상**: 핀 찍기 모드(`PDF에서 위치를 누르세요`)와 `"해결로 표시해도 교수 응답은 바뀌지 않아요."` 안내 및 390px 모바일 탭 전환은 명확함. | `live-professor-editor/p04_prof_review_detail.png`, `p05_prof_review_need_revision_ui.png`, `p06_prof_review_pin_mode.png`, `p07_prof_review_390.png` |
| N5 | `/schedule/48871122-...` | 교수 일정 조율 응답 화면 | 일정 조율 배너 클릭 | `[라이브]` | `pages/SchedulePollPage.tsx` | **이슈(레이아웃 불균형)**: 1440px 카드 내부 상단 시간표 위젯(`~360px`)이 좌측에 좁게 고정되어 우측 ~70%가 빈 여백으로 남고, 바로 아래 전체 폭 체크박스 리스트가 같은 날짜 3건을 중복 표시함. | `live-professor-editor/p08_prof_schedule_poll.png` |
| N6 | `/r/7f09c2a1-...` (홈·전환기·미팅·할 일·글·자료) | **공동연구자(`편집자`)** 권한 화면 전반 | 연구 진입 및 4개 탭 순회 | `[라이브]` | `pages/ResearchHomePage.tsx`, `MeetingsPage.tsx`, `TasksPage.tsx`, `DocsPage.tsx` | **정상·우수(비공개 격리 검증)**: 학생 소유자의 비공개 미팅 5건(녹음·전사)과 비공개 원고(`글 0`)가 편집자에게 완전히 숨겨지고 `함께 보기` 자료 6건·공유 일정·검토만 노출됨. 공동연구 전용 `내 할 일 \| 모두` 필터 정상 작동. **이슈**: 편집자 홈에서 보이는 미팅이 0건이라 이미 5차 미팅을 진행한 연구임에도 우측에 `시작하기 3 / 4 (미팅 기록 남기기)` 온보딩 카드가 다시 뜸. | `live-professor-editor/e01_editor_home.png`, `e02_editor_switcher.png`, `e03_editor_meetings.png`, `e05_editor_tasks.png`, `e06_editor_docs.png`, `_prof_editor_metrics.json` |
| N7 | `?settings=research` (`연구 정보`·`함께하는 사람`·`보관·삭제`·`프로필`) | **공동연구자(`편집자`)** 설정 권한 제한 | 설정 탭 순차 클릭 | `[라이브]` | `pages/SettingsPage.tsx`, `PeopleTab.tsx`, `DangerTab.tsx` | **정상·우수(소유자 권한 가드 검증)**: `함께하는 사람`에서 `접근 해제` 버튼과 `공동연구자` 초대 토글이 숨겨져 `지도교수` 초대만 허용되고, `보관·삭제` 탭의 `연구 보관`·`휴지통으로 옮기기` 버튼이 비활성화되며 `"연구 소유자만 보관하거나 휴지통으로 옮길 수 있어요."` 안내가 명확히 표시됨. | `live-professor-editor/e07_editor_settings_research.png`, `e08_editor_settings_people.png`, `e09_editor_settings_danger.png`, `e10_editor_settings_profile.png` |

---

## 3. 미검증 항목 목록 및 사유 (투명 기록)

교수 계정 및 공동연구자(`editor`) 라이브 화면 검증을 완료함에 따라, 남은 미검증 항목은 운영 보호·하드웨어 제약 범위로 축소되었다.

1. **운영 데이터·유료 API·실시간 하드웨어 의존 흐름 (`[미검증]` — 운영 보호 원칙)**:
   - 유료 AI 모델 실제 스트리밍/사고 과정 모션, 실제 마이크 녹음·전사·무음 경고, 초대 이메일 발송, 결제/플랜 변경.
2. **고급 엣지 상태 (`[미검증]` / `[코드 확인]`)**:
   - 오프라인/API 500 오류 복구 화면, 동시 편집 충돌(`TextComparison`), 실기기 터치 제스처.
3. **심층 배치 중 미저장된 보조 캡처 3건 (`[미검증]`)**:
   - 도우미 입력창 `+` 메뉴(`d25`), 연구 흐름 다이어그램 탭(`d35`), `CompareView` 내부 `슬라이더` 탭 프레임(`compare_slider_50`)은 셀렉터 타임아웃으로 미저장되어 목록에서 제외했다.
