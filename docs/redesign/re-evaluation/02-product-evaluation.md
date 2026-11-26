# [산출물 C] MARGIN — 10개 영역 종합 제품 평가서 (Phase 3)

- **작성일**: 2026-11-25
- **평가 기준선**: `margin-research.pages.dev` 라이브 배포(학생 `student@margin.com` + 교수·공동연구자 `professor@margin.com`), `Margin-repo` HEAD `4fce15e` (`#184`, 미커밋 4파일 보존), 로컬 격리 프리뷰(`dist/e2e-preview`)
- **근거 자료**: `01-product-map.md`, `02-visual-archive-index.md`, `assets/` **총 154개 증거 파일** (기존 85 + 심층 45 + 교수·공동연구자 20 + 격리 보강 4)
- **스크린샷 중심 탐색기**: 같은 폴더의 `02-product-evaluation-gallery.html`을 브라우저에서 열면 본 문서의 모든 평가 항목을 실제 스크린샷·영역·판정 분류·18개 문제의식별로 인터랙티브하게 탐색할 수 있다.

## 평가 분류 체계 (4분류 + 강점)
- **`[유지·강점]`**: 제품 핵심 가치에 부합하고 구현 완성도가 높아 반드시 지켜야 할 자산
- **`[사용성 문제]`**: 사용자의 과업 완료·이해·예측 가능성을 실제로 저해하거나 마찰을 역전시키는 설계 결함
- **`[기술적 결함]`**: 텍스트 잘림·라벨 겹침·포인터 이벤트 가로채기·권한/상태 분기 오류 등 명백한 구현 결함
- **`[디자인 취향]`**: 기능·이해에는 지장이 없으나 시각적 세련됨·여백 비례·“AI 티” 제거 등 프로덕트 완성도 차원의 개선 대상
- **`[의도된 설계 차이]`**: 제품 불변 조건(프라이버시 격리, 상태 비혼합, 실수 방지)을 위한 의도적 트레이드오프

---

## 총괄 진단 요약

마진(Margin)은 **“지도 미팅 → 피드백 → 할 일 → 수정 원고·PDF → 교수 검토 요청·응답 → 다음 미팅”**이라는 대학원 연구자의 실제 순환 고리를 도메인 모델과 기능 단위에서 매우 탄탄하게 구현한 제품이다. 특히 단독 교수 검토 화면의 프라이버시 격리, 공동연구자 비공개 분리, 원고 버전 비교(`WordDiff`), PDF 텍스트 추출 및 컨텍스트 연결, 한글 초성 `⌘K` 검색 등은 이미 상용 제품 수준의 핵심 역량을 갖추고 있다.

반면 라이트 모드 데스크톱(1440px) 기준에서 제품이 “프로덕트 수준”으로 체감되지 못하게 만드는 원인은 개별 버그보다 **5가지 구조적 불일치**에 있다.
1. **역할·공간 중복과 충돌**: 1440px 기본 열림 사이드 패널(`할 일`)이 홈 화면 하단(`할 일`)과 동일 데이터를 다른 정렬 순서로 중복 노출하며, 교수가 공동연구자(`편집자`)를 겸하는 검토 화면에서는 발신자(학생) UI와 수신자(교수) UI가 한 화면에 충돌한다.
2. **위험도와 마찰의 역전**: 복원 가능한 ‘휴지통 이동’에는 긴 연구명 타이핑을 요구하고, 복원 불가능한 ‘완전 삭제’에는 미완성 슬라이더를 배치해 안전장치의 방향이 반대로 설계되어 있다.
3. **시각 위계·컴포넌트 혼재**: 페이지 제목(`h1`)이 `28px/700`, `20px/700`, `20px/400`, `없음`으로 4갈래로 갈라지고, Montage UI + Kokonut UI + 브라우저 기본 `<select>` + 좌측 파란 띠(`border-left`)가 한 화면에 혼재한다.
4. **밀도·여백 불균형**: 일정 조율 화면은 상단 위젯이 좌측 ~360px에만 갇혀 70% 공백을 남기고 아래에 동일 날짜를 중복 나열하는 반면, 312px 피드백 상세 패널의 오디오 트리머 라벨은 겹쳐 깨진다.
5. **문구·상태 시점 불일치**: 교수 알림 모달에 학생 시점 문구(`"교수 응답과 댓글..."`)가 남고, 빈 미팅 화면에서 `"왼쪽 목록에서 기록을 고르거나..."`를 출력하며, 크레딧 표기가 의도된 `%`가 아닌 `19,190크레딧`으로 남아 있다.

---

## 10개 영역별 심층 평가

### 01. 제품 기획 (Product Strategy & Feature Necessity)

| ID | 분류 | 대상 기능 / 컴포넌트 | 화면 증거 | 사용자 맥락 및 독립 판단 근거 | 관련 코드 경로 |
|---|---|---|---|---|---|
| P01-S1 | `[유지·강점]` | 연구 순환 루프(미팅→피드백→할 일→검토→다음 미팅) | `live-desktop/19_meeting_detail_1440.png`, `live-professor-editor/p09_prof_only_review_detail.png` | 대학원생의 가장 큰 고통인 “지도교수 피드백의 유실”을 정확히 겨냥한 핵심 구조. 검토 요청에 `먼저 볼 위치(1페이지 · 비교 기준 표)`와 `보낸 당시 파일`을 스냅샷으로 고정한 기획은 제품 차별화의 중심이므로 반드시 유지해야 한다. | `lib/domain.ts`, `pages/ReviewDetailPage.tsx` |
| P01-S2 | `[의도된 설계 차이]` | 5개 독립 상태 비혼합 원칙 | `live-professor-editor/p06_prof_review_pin_mode.png` | `할 일 완료 ≠ 수정 제출 ≠ 교수 응답 ≠ 댓글 해결 ≠ 읽음` 분리 및 `"해결로 표시해도 교수 응답은 바뀌지 않아요."` 명시는 학술 지도 맥락에서 오해를 막는 핵심 안전장치다. 단순화를 이유로 합치면 안 된다. | `AGENTS.md`, `pages/ReviewDetailPage.tsx` |
| P01-1 | `[사용성 문제]` | 연구 도우미 `제안`·`실행 내역` 별도 탭의 필요성 | `live-desktop/13_assistant_suggestions_1440.png`, `13_assistant_runs_1440.png` | 사용자가 AI와 대화한 뒤 채택할 제안을 찾으려면 `대화` 탭을 벗어나 `제안`·`실행 내역` 탭으로 이동해야 한다. 대화 맥락에서 분리된 탭은 인지 단절을 일으키며, 실제 사용 빈도 대비 상단 탭 면적을 과도하게 점유한다. (디자이너 문제의식 #12 — 대화 내 인라인 카드 통합 여부를 Phase 5에서 비교 검토 필요) | `components/assistant/AssistantSidePanel.tsx` |
| P01-2 | `[사용성 문제]` | 우측 레일 하단 `의견`의 외부 `mailto:` 이탈 | `live-desktop/14_home_main_1440.png` | 베타/UT 단계에서 사용자 의견을 수집하려면 현재 보고 있는 화면 맥락을 유지한 채 10초 안에 피드백을 남길 수 있어야 한다. `mailto:admin@margin.com`은 OS 메일 앱을 강제 실행시켜 이탈률이 매우 높다. (디자이너 문제의식 #15) | `components/shell/SideRail.tsx` (`FEEDBACK_MAIL`) |
| P01-3 | `[사용성 문제]` | 교수 `/r` 상단의 `+ 연구 만들기` 강조 CTA | `live-professor-editor/p01_prof_r_home.png` | `AGENTS.md` 불변 조건상 주 사용자는 학생이고 교수는 지정된 검토·일정 조율에 접근한다. 그럼에도 교수 `/r` 화면 최상단에 파란 `+ 연구 만들기` CTA가 가장 강하게 배치되어 교수 사용자의 첫 시선을 엉뚱한 행동으로 유도한다. | `pages/AuthPages.tsx` (`ResearchSelectPage`) |

---

### 02. 정보 구조 (IA & Role Architecture)

| ID | 분류 | 대상 기능 / 컴포넌트 | 화면 증거 | 사용자 맥락 및 독립 판단 근거 | 관련 코드 경로 |
|---|---|---|---|---|---|
| P02-S1 | `[유지·강점]` | 상단 4메뉴(`홈·미팅·할 일·글·자료`) 단순 IA | `live-desktop/14_home_main_1440.png` | 기존 6~9개 좌측 사이드바에서 상단 4축으로 정리한 IA v2 방향은 연구자의 작업 단위와 잘 맞고 학습 비용이 낮다. | `components/shell/TopBar.tsx` |
| P02-S2 | `[유지·강점]` | 단독 교수 검토 셸 & 공동연구자 비공개 격리 | `live-professor-editor/p09_prof_only_review_detail.png`, `e03_editor_meetings.png`, `e06_editor_docs.png` | 공동연구자가 아닌 교수에게 학생 워크스페이스 크롬을 완전히 숨긴 전용 검토 셸과, 편집자에게 비공개 미팅 5건·비공개 원고를 철저히 숨기는 권한 격리는 신뢰성 측면에서 매우 우수하다. | `pages/ReviewDetailPage.tsx`, `pages/MeetingsPage.tsx` |
| P02-1 | `[사용성 문제]` | 홈 하단 4탭 ↔ 우측 사이드 패널 `할 일` 중복 및 정렬 불일치 | `isolated-local/07_offline_banner_1440.png`, `live-desktop/14_home_main_1440.png` | 1440px 초기 진입 시 우측 사이드 패널이 `할 일` 탭으로 자동 열리면서, 좌측 홈 `할 일` 탭과 **완전히 같은 3개 항목이 서로 다른 순서**(홈: 11/27→11/28→5일 지남 / 패널: 5일 지남→11/27→11/28)로 동시에 보인다. 홈이 단순 목록 재탕이 되어 본연의 대시보드·일정/로드맵 역할을 잃는다. (디자이너 문제의식 #2, #3) | `pages/HomePage.tsx`, `lib/side-panel.ts` |
| P02-2 | `[기술적 결함]` | 교수 + 공동연구자(`편집자`) 겸임 시 검토 화면 역할 충돌 | `live-professor-editor/p04_prof_review_detail.png`, `p05_prof_review_need_revision_ui.png` | 교수가 해당 연구의 편집자를 겸하면 검토 상세가 학생 워크스페이스 셸 안에 열리며, 교수 본인에게 `"professor@margin.com에게 공유"`, `"교수님께 메일로도 알리기"`, `공유 설정`, `다시 확인 요청`과 `"내가 남긴 응답"`이 동시에 노출된다. 역할 판별 우선순위(수신자 vs 편집자) 분리 누락이다. | `pages/ReviewDetailPage.tsx` |
| P02-3 | `[사용성 문제]` | 연구 전환기(`ResearchSwitcher`) 스크롤 및 `새 연구 만들기` 위치 | `live-desktop/07_research_switcher_1440.png` | 긴 연구명이 드롭다운 내부에서 3~4줄로 줄바꿈되며 하단 `모든 연구 보기`가 스크롤 아래로 밀린다. 또한 `새 연구 만들기`가 연구 전환 드롭다운과 `/r` 허브에 중복 배치되어 전환기의 목적(빠른 이동)을 흐린다. (디자이너 문제의식 #1) | `components/shell/TopBar.tsx` |
| P02-4 | `[사용성 문제]` | 우측 레일 하단 `화면 배치`·`설정`과 계정 메뉴·설정 중복 | `live-desktop/11_rail_layout_menu_1440.png`, `10_account_menu_1440.png` | 설정 진입점이 우측 레일 하단 `설정`, `화면 배치 → 화면 설정 모두 보기`, 계정 메뉴 `프로필 설정` 등 3곳 이상으로 분산되어 있다. 레일은 핵심 작업 패널 전환에만 집중할 필요가 있다. (디자이너 문제의식 #3) | `components/shell/SideRail.tsx` |
| P02-5 | `[사용성 문제]` | `+ 기록 추가` 드롭다운에 6개 이질 워크플로우 혼재 | `live-desktop/18_meetings_add_menu_1440.png`, `live-desktop-deep/d11_dialog_new_review.png` | ‘녹음 시작’(즉시 실행), ‘서면 피드백 붙여넣기’(기록), ‘다음 미팅 잡기’(일정), ‘시간 조율’(투표), ‘교수님께 검토 요청’(제출)이 평면 목록에 섞여 있어 성격이 다른 행동이 구분되지 않는다. (디자이너 문제의식 #18) | `pages/MeetingsPage.tsx`, `components/shell/TopBar.tsx` |

---

### 03. 사용자 경험 (UX & 10대 사용자 여정)

| ID | 분류 | 대상 기능 / 컴포넌트 | 화면 증거 | 사용자 맥락 및 독립 판단 근거 | 관련 코드 경로 |
|---|---|---|---|---|---|
| P03-S1 | `[유지·강점]` | 빈 연구 홈 `시작하기 1 / 4` 체크리스트 | `live-desktop-deep/d40_empty_research_home.png` | 처음 연구를 만든 학생에게 다음 행동 4가지를 진행률 바와 함께 명확히 제시해 콜드 스타트 이탈을 줄인다. | `components/home/StartChecklist.tsx` |
| P03-S2 | `[유지·강점]` | `⌘K` 한글 초성 검색 & 빈 상태 안내 | `live-desktop-deep/d38_cmdk_chosung_search.png`, `d39_cmdk_empty_state.png` | `ㅁㅌ` 입력만으로 미팅 항목을 즉시 매칭하고, 결과 없음에도 명확한 한국어 피드백을 제공한다. | `components/shell/CommandPalette.tsx` |
| P03-S3 | `[유지·강점]` | PDF v2 상세의 컨텍스트 맞춤 AI 칩 3종 & 텍스트 추출 | `live-desktop-deep/d19_pdf_v2_detail.png`, `d20_pdf_text_view.png` | 보고 있는 PDF를 AI 컨텍스트로 자동 인식하고 바로 쓸 수 있는 3개 시작 칩과 페이지 텍스트 추출을 제공해 학술 작업 흐름이 매끄럽다. | `pages/MaterialsPage.tsx`, `lib/assistant-starters.ts` |
| P03-1 | `[사용성 문제]` | 연구 도우미 홈 빈 상태 추천 프롬프트 빈약(1개) | `live-desktop/12_assistant_chat_1440.png` | PDF 상세에서는 맥락 칩 3개를 주면서 정작 가장 자주 여는 홈에서는 `"이번 주 할 일 정리하기"` 1개만 덩그러니 떠 있어 AI 활용 가능성이 좁아 보인다. (디자이너 문제의식 #13) | `lib/assistant-starters.ts`, `pages/assistant/AssistantPanel.tsx` |
| P03-2 | `[기술적 결함]` | 공동연구자 홈에서 완료된 연구에 `시작하기 3 / 4` 온보딩 재노출 | `live-professor-editor/e01_editor_home.png` | 이미 5차 미팅을 진행한 연구임에도 편집자에게 보이는 미팅이 0건(비공개)이라는 이유로 우측에 `시작하기 3 / 4 (미팅 기록 남기기)` 온보딩 카드가 다시 뜬다. 체크리스트 노출 조건이 ‘연구 진행도’가 아니라 ‘현재 사용자의 가시 미팅 수’에 묶인 부작용이다. | `components/home/StartChecklist.tsx` |
| P03-3 | `[사용성 문제]` | 일정 조율(`/schedule/:pollId`) 화면의 상하 중복 및 70% 여백 | `live-professor-editor/p08_prof_schedule_poll.png`, `live-desktop/29_schedule_poll_1440.png` | 상단 타임라인 위젯이 좌측 ~360px에만 좁게 배치돼 우측 70%가 비어 있고, 바로 아래에 같은 3개 날짜의 체크박스 행이 전체 폭으로 중복 배치되어 “어디를 눌러야 응답되는가”가 직관적이지 않다. | `pages/PollPage.tsx`, `components/poll/AvailabilityGrid.tsx` |
| P03-4 | `[사용성 문제]` | 설정 모달 전반의 정보 밀도·컨트롤 완성도 부족 | `live-desktop/31_settings_display_1440.png`, `31_settings_notifications_1440.png`, `31_settings_usage_1440.png` | 좌측 10개 탭은 잘 분리됐으나, 우측 본문이 좁은 폭에 단조로운 입력 폼과 장문 보조 설명이 나열되어 `사용량·플랜`·`화면`·`알림`의 핵심 상태가 한눈에 들어오지 않는다. (디자이너 문제의식 #16) | `components/settings/SettingsDialog.tsx`, `pages/settings/*` |

---

### 04. 인터랙션 설계 (Interaction Design & Friction)

| ID | 분류 | 대상 기능 / 컴포넌트 | 화면 증거 | 사용자 맥락 및 독립 판단 근거 | 관련 코드 경로 |
|---|---|---|---|---|---|
| P04-S1 | `[유지·강점]` | 할 일 완료 6초 되돌리기 토스트 + 공동연구자 권한 가드 | `isolated-local/01_task_done_toast_1440.png`, `live-professor-editor/e09_editor_settings_danger.png` | 가벼운 액션에는 즉시 실행 + 되돌리기(Undo)를 제공하고, 소유자 전용 보관/삭제에는 버튼 비활성화 + 이유 설명을 병기한 점은 정석적이다. | `pages/TasksHome.tsx`, `pages/settings/DangerTab.tsx` |
| P04-1 | `[사용성 문제]` | 휴지통 이동(타이핑) vs 완전 삭제(슬라이더) 마찰 역전 | `live-desktop/03_modal_permanent_delete_1440.png`, `live-desktop/02_r_trash_1440.png` | **복원 가능한 ‘휴지통 이동’**에는 40자 넘는 긴 연구 이름을 오타 없이 입력하게 하면서, **복원 불가능한 ‘완전 삭제’**에는 단 한 번의 드래그 슬라이더만 요구한다. 위험도와 마찰의 방향이 완전히 뒤집혀 있으며, 긴 연구명 입력 시 복사 버튼도 없다. (디자이너 문제의식 #5) | `pages/AuthPages.tsx`, `components/PermanentResearchDelete.tsx` |
| P04-2 | `[사용성 문제]` | `공유 설정` 다이얼로그 내부에 `SlideToConfirm`과 일반 저장 버튼 혼재 | `live-desktop-deep/d26_review_share_dialog.png` | 일반 설정 변경(`설정 저장`, `취소`, `✕`)과 파괴적 동작(`밀어서 공유 중지`)이 한 모달에 동거해 사용자가 “저장해야 중지되는지, 밀면 즉시 중지되는지” 혼동한다. | `components/reviews/ReviewShareDialog.tsx` |
| P04-3 | `[사용성 문제]` | 계정 메뉴 `로그아웃 길게 누르기`의 데스크톱 마찰 | `live-desktop/10_account_menu_1440.png` | 로그아웃은 데이터 손실이 없는 가역 액션인데, 데스크톱에서 클릭으로 작동하지 않고 약 1.8초 길게 눌러야 하는 패턴은 발견성과 예측 가능성이 떨어진다. (실제 검수 중에도 일반 클릭에 반응하지 않음을 확인) (디자이너 문제의식 #18) | `components/kokonut/profile-dropdown.tsx` |
| P04-4 | `[사용성 문제]` | 모달 `✕` 닫기 버튼과 하단 `취소` 버튼 중복 | `live-desktop/03_modal_permanent_delete_1440.png`, `isolated-local/04_recording_ui_preview_1440.png` | 특히 주 확인 버튼이 없는 `완전히 삭제` 슬라이더 모달에 우상단 `✕`와 우하단 `취소`가 동시에 존재해 시각적 군더더기를 만든다. (디자이너 문제의식 #8) | `components/PermanentResearchDelete.tsx`, `components/ui/dialog.tsx` |

---

### 05. 마이크로 인터랙션 · 모션 (Micro-interactions & Motion)

| ID | 분류 | 대상 기능 / 컴포넌트 | 화면 증거 | 사용자 맥락 및 독립 판단 근거 | 관련 코드 경로 |
|---|---|---|---|---|---|
| P05-S1 | `[유지·강점]` | TopBar 탭 호버 툴팁 & 사이드 패널 드래그 리사이즈 & 모바일 스와이프 | `live-desktop-deep/d37_topbar_nav_hover_hint.png`, `motion/panel_resize_450.png`, `motion/panel_resize_600.png`, `motion/swipe_task_90px.png` | TopBar 탭 호버 시 단축키(`G M`)와 다음 미팅 맥락을 보여주는 마이크로 프리뷰, 450→600px 부드러운 패널 리사이즈, 90px 모바일 스와이프 액션 노출은 완성도가 높다. | `components/shell/TopBar.tsx`, `components/shell/PanelResizer.tsx`, `lib/swipe.ts` |
| P05-1 | `[기술적 결함]` | `SlideToConfirm` 드래그 진행 채움 끝단 직선 끊김 & 텍스트 겹침 | `motion/slide_delete_25.png`, `motion/slide_delete_50.png`, `motion/slide_delete_72.png` | 드래그 25%·50%·72% 연속 프레임 실측 결과, 원형 썸(`→`) 뒤의 빨간 진행 배경이 썸 곡률에 맞지 않고 직선으로 끊기며, 중앙 라벨(`밀어서 완전히 삭제`)이 페이드아웃되지 않아 썸과 글자가 어설프게 겹친다. (디자이너 문제의식 #7) | `components/SlideToConfirm.tsx` |
| P05-2 | `[기술적 결함]` | Montage UI 드롭다운 `with-interaction` 오버레이 포인터 가로채기 | `live-desktop-deep/d16_editor_versions_menu.png`, `d18_editor_compare_worddiff.png` | 버전 드롭다운 항목 내부의 `<div data-component="with-interaction">` 레이어가 자식 `<span>`의 포인터 이벤트를 가로채 자동화·보조기기·특정 클릭 위치에서 상호작용 실패를 유발한다. | `components/docs/*`, `@montage-ui/core` 래퍼 |

---

### 06. 시각 디자인 (Light Mode Desktop Visual Polish)

| ID | 분류 | 대상 기능 / 컴포넌트 | 화면 증거 | 사용자 맥락 및 독립 판단 근거 | 관련 코드 경로 |
|---|---|---|---|---|---|
| P06-S1 | `[유지·강점]` | 원고 에디터 `WordDiff` 및 PDF v2 가독성 | `live-desktop-deep/d18_editor_compare_worddiff.png`, `d19_pdf_v2_detail.png` | 밝은 표면 위 깔끔한 타이포와 한글 표 렌더링, 버전 비교 색상 대비가 안정적이라 장시간 읽기에 무리가 없다. | `components/docs/WordDiff.tsx`, `components/materials/PdfViewer.tsx` |
| P06-1 | `[디자인 취향]` | 우측 `SideRail` 선택 상태의 옹졸함 및 하단 아이콘 비대칭 | `live-desktop/14_home_main_1440.png`, `metrics/batch1_live.json` | 상단 4탭(`60×58px`)은 선형(stroke) 아이콘만 유지한 채 작은 회색 박스만 들어가 활성 대비가 약하고, 하단은 `의견`만 라벨이 있고 `화면 배치`·`설정`은 `32×32px` 회색 사각 박스로 처리돼 시각 문법이 깨진다. (디자이너 문제의식 #3) | `components/shell/SideRail.tsx`, `components/shell/shell.css` |
| P06-2 | `[디자인 취향]` | 홈 상단 알림 카드 좌측 파란 띠(`border-left`)의 “AI 티” | `live-desktop/06_home_long_1440.png`, `isolated-local/07_offline_banner_1440.png` | 흰 카드 좌측에 두꺼운 파란 선을 세우는 패턴은 전형적인 AI 생성 대시보드 스타일로, 마진 특유의 차분한 학술 도구 톤과 어긋난다. (디자이너 문제의식 #9) | `pages/HomePage.tsx` |
| P06-3 | `[기술적 결함]` | `투고까지 D-83` 칩 등 배지 텍스트 수직 중앙 정렬 이탈 | `live-desktop/06_home_long_1440.png` | 헤더 우측 `투고까지 D-83` pill 내부 텍스트가 수직 중앙보다 미세하게 치우쳐 보여 픽셀 단위 마감 완성도를 떨어뜨린다. (디자이너 문제의식 #10) | `components/home/SubmissionCountdown.tsx` |
| P06-4 | `[사용성 문제]` | 휴지통 카드 `복원`·`완전히 삭제` 인접 배치 및 위험 위계 부족 | `live-desktop/02_r_trash_1440.png` | `복원` 바로 옆에 회색 `🗑 완전히 삭제`가 붙어 있어 실수 클릭 위험이 있고, 파괴적 액션의 시각적 경고(빨간 톤/좌우 분리)가 부족하다. (디자이너 문제의식 #6) | `pages/AuthPages.tsx`, `components/PermanentResearchDelete.tsx` |
| P06-5 | `[디자인 취향]` | 공개 랜딩·기능·플랜 페이지 브랜드 완성도 | `live-desktop/33_public_landing_1440.png`, `33_public_features_1440.png`, `33_public_pricing_1440.png` | 정보 전달은 깔끔하나 히어로 타이포 스케일, 시선 유도 리듬, 실제 연구 화면의 생동감 전달력이 레퍼런스(`benchmarks/ref_toss_im.png`) 대비 평면적이다. (디자이너 문제의식 #17) | `pages/PublicPages.tsx`, `components/marketing/*` |

---

### 07. 디자인 시스템 · 컴포넌트 (Design System & Component Consistency)

| ID | 분류 | 대상 기능 / 컴포넌트 | 화면 증거 | 사용자 맥락 및 독립 판단 근거 | 관련 코드 경로 |
|---|---|---|---|---|---|
| P07-S1 | `[유지·강점]` | `#184` 공통 `RowActions` (우클릭·`⋯`·스와이프 통합) | `live-desktop/23_docs_context_menu_1440.png`, `04_research_card_menu_1440.png` | 목록 행 액션을 하나의 패턴으로 공통화해 페이지 간 학습 전이 효과를 높였다. | `components/RowActions.tsx` |
| P07-1 | `[기술적 결함]` | 페이지 제목(`h1`) 타이포그래피 4갈래 파편화 | `metrics/batch1_live.json`, `batch2_live.json`, `live-desktop/14_home_main_1440.png`, `20_tasks_1440.png`, `22_docs_list_1440.png`, `17_meetings_list_1440.png` | 실측 결과 `/tasks`·`/flow` `28px/700`, `/r/:id` 홈 `20px/700`, `/docs` `20px/400`, `/meetings` `h1` 없음으로 완전히 파편화되어 있다. 공통 `PageHeader` 토큰 부재가 원인이다. (디자이너 문제의식 #4) | 각 페이지 CSS + `design/styles.css` |
| P07-2 | `[기술적 결함]` | 항목 상세(`?detail=`) 및 미팅 필터의 브라우저 기본 `<select>` 노출 | `live-desktop-deep/d01_itemdetail_task.png`, `live-professor-editor/e03_editor_meetings.png` | Montage UI 디자인 시스템 위에서 `진행 중`, `높음`, `고르지 않음`, `전체` 필터가 OS 기본 `<select>` 화살표로 렌더링돼 컴포넌트 통일성이 크게 떨어진다. | `components/detail/ItemDetailPanel.tsx`, `pages/MeetingsPage.tsx` |
| P07-3 | `[기술적 결함]` | 312px 피드백 상세 오디오 트리머 라벨 겹침 & 도트 라벨 부재 | `live-desktop-deep/d02_itemdetail_feedback.png` | `clip-trimmer`가 312px 좁은 패널 폭에 대응하지 못해 `90s105s120s135s150s` 텍스트가 서로 겹쳐 읽을 수 없다. 상단 5개 상태 도트 역시 텍스트나 툴팁 없이는 의미를 알 수 없다. | `components/kokonut/clip-trimmer.tsx`, `components/detail/ItemDetailPanel.tsx` |
| P07-4 | `[기술적 결함]` | 녹음 미팅 카드 `음성 공유` 텍스트 우측 잘림 | `live-desktop-deep/d07_meeting_recorded_audio.png` | `제5차 논문 지도` 음성 재생 카드 우측 끝에서 `음성 공유` 라벨이 컨테이너 경계에 걸려 잘린다. | `components/meetings/MeetingAudioCard.tsx` |
| P07-5 | `[기술적 결함]` | 비지원 파일 오류 토스트가 `SideRail` 하단 아이콘 가림 | `isolated-local/06_upload_invalid_or_error_1440.png` | 우하단 Sonner 토스트가 우측 64px 레일 영역을 침범해 `화면 배치`·`설정` 버튼 위에 그대로 겹친다. | `main.tsx` (`Toaster`), `components/shell/shell.css` |

---

### 08. UX 라이팅 (Copywriting & Mental Model)

| ID | 분류 | 대상 기능 / 컴포넌트 | 화면 증거 | 사용자 맥락 및 독립 판단 근거 | 관련 코드 경로 |
|---|---|---|---|---|---|
| P08-S1 | `[유지·강점]` | 검토 요청 프라이버시 고지 및 재확인 체크박스 문구 | `live-desktop-deep/d11_dialog_new_review.png`, `d27_review_recheck_dialog.png` | `"개인 메모·할 일·AI 대화 미포함"`처럼 사용자가 가장 불안해하는 지점을 정확히 짚어주는 문구는 신뢰감을 높인다. | `components/reviews/*` |
| P08-1 | `[사용성 문제]` | 홈 상단 배너 `[기록 정리하기]` 문구 모호성 | `live-desktop/06_home_long_1440.png` | `"지난 미팅에서 나온 할 일을 아직 정리하지 않았어요."` 옆 버튼이 `[기록 정리하기]`로 되어 있어 미팅 메모를 고치는 것인지, 할 일을 추출하는 것인지 행동 결과가 모호하다. (디자이너 문제의식 #11) | `lib/home-action.ts`, `pages/HomePage.tsx` |
| P08-2 | `[사용성 문제]` | 잔액 크레딧 표기 (`19,190크레딧` vs `%` 전환 미반영) | `live-desktop/12_assistant_chat_1440.png`, `31_settings_usage_1440.png` | 사용자는 `19,190크레딧`이 얼마나 남은 것인지 직관적으로 가늠하기 어렵다. 기획 의도였던 잔여 `%` 표현이 `AICreditStatus.tsx`에 반영되지 않고 원시 숫자 그대로 노출되고 있다. (디자이너 문제의식 #14) | `components/ai/AICreditStatus.tsx`, `pages/settings/UsageMeters.tsx` |
| P08-3 | `[기술적 결함]` | 빈 `/meetings` 화면의 모순된 안내 문구 & 교수 알림 학생 시점 문구 | `live-desktop-deep/d42_empty_research_meetings.png`, `live-professor-editor/p03_prof_notifications.png` | 좌측 목록이 0건인데도 `"왼쪽 목록에서 기록을 고르거나..."`를 출력하고, 교수 알림 모달 부제에 `"교수 응답과 댓글..."`이 그대로 노출된다. 상태/역할별 카피 분기 누락이다. | `pages/MeetingsPage.tsx`, `components/shell/NotificationModal.tsx` |
| P08-4 | `[디자인 취향]` | 휴지통·삭제 모달 3~4줄 장문 설명 | `live-desktop/03_modal_permanent_delete_1440.png` | 파괴적 확인 모달은 긴 문단보다 핵심 결과 1~2줄이 인지 속도와 경고 효과가 높다. (디자이너 문제의식 #8) | `components/PermanentResearchDelete.tsx` |

---

### 09. 반응형 · 접근성 · 환경 (Responsive, Dark Mode, Accessibility, Edge States)

| ID | 분류 | 대상 기능 / 컴포넌트 | 화면 증거 | 사용자 맥락 및 독립 판단 근거 | 관련 코드 경로 |
|---|---|---|---|---|---|
| P09-S1 | `[유지·강점]` | 모바일 하단 5탭, 교수 검토 390px 2탭, 오프라인 배너 우선순위 | `live-mobile/home_390.png`, `live-professor-editor/p07_prof_review_390.png`, `isolated-local/07_offline_banner_1440.png` | 390px 모바일에서 검토 항목 가로 스와이프 + `수정 내용·파일 / 교수 응답·댓글` 탭 전환과, 오프라인 시 `ShellBanners` 단일 배너 우선순위가 안정적으로 동작한다. | `components/shell/BottomDock.tsx`, `ShellBanners.tsx` |
| P09-1 | `[기술적 결함]` | `DocsPage` 3단 미리보기(`👁`) 시 넓은 화면 테이블 메타 열 붕괴 | `live-desktop-deep/d12_docs_3col_preview.png` | `#184`에서 넓은 화면 열 표시를 개선했으나, 우측 미리보기 패널을 여는 순간 컨테이너 폭 축소로 행이 2줄로 접히며 밀도가 급격히 무너진다. | `pages/DocsPage.tsx` |
| P09-2 | `[기술적 결함]` | 320px/390px 좁은 폭 밀집, 전역 11px 스크롤 거터, 지연 텍스트 대비 | `live-mobile/docs_320.png`, `dark-mode/dark_tasks_1440.png`, `live-desktop/20_tasks_1440.png` | `html { scrollbar-gutter: stable }`로 인한 우측 11px 거터, `#FF4242` 지연 텍스트의 라이트 배경 대비 부족, 다크 모드 보조 테두리·배지 대비 약화 등 기존 독립 검수 항목(MA-01, MA-09)이 여전히 유효하다. (디자이너 문제의식 #18) | `design/styles.css:84`, `design/tokens.css` |

---

### 10. 코드 · 기술 구현 (Frontend Architecture & Reliability)

| ID | 분류 | 대상 기능 / 컴포넌트 | 화면 증거 | 사용자 맥락 및 독립 판단 근거 | 관련 코드 경로 |
|---|---|---|---|---|---|
| P10-S1 | `[유지·강점]` | URL 쿼리 기반 오버레이(`?detail=`, `?settings=`) & 5개 상태 데이터 모델 | `live-desktop-deep/d01_itemdetail_task.png`, `live-desktop/31_settings_profile_1440.png` | 상세 패널과 설정 모달을 URL 쿼리로 관리해 뒤로가기·딥링크 복원이 자연스럽고, 29개 엔티티 도메인 모델이 명확히 정규화되어 있다. | `components/shell/WorkspaceShell.tsx`, `lib/domain.ts` |
| P10-1 | `[기술적 결함]` | 삭제된 검토 댓글(`"삭제한 댓글이에요."`) 하단에 `답글`·`해결로 표시` 활성 잔존 | `live-professor-editor/p06_prof_review_pin_mode.png` | 소프트 삭제된 댓글의 본문만 치환하고 액션 버튼 렌더링 조건(`!comment.deletedAt`)을 누락해 삭제된 댓글에 답글/해결을 누를 수 있는 상태가 노출된다. | `pages/ReviewDetailPage.tsx` |
| P10-2 | `[기술적 결함]` | 다중 UI 라이브러리 혼용으로 인한 스타일·이벤트 충돌 | `live-desktop-deep/d16_editor_versions_menu.png`, `d01_itemdetail_task.png` | `@montage-ui/core` + `radix-ui` + `@base-ui/react` + Kokonut 원본 + 네이티브 `<select>` + `disarto-icons`/`lucide-react` 2종 아이콘이 공존하면서 포인터 가로채기(`with-interaction`), 아이콘 선 굵기 불일치, CSS 레이어 충돌의 근본 원인이 되고 있다. | `package.json`, `components/icons.tsx`, `design/layers.css` |

---

## 디자이너 18개 필수 검토 대상 + 기존 가설 독립 재평가 매트릭스

> 아래 표는 실행 계획서의 18개 문제의식을 **가설로 취급**해 Phase 2~3 실증 증거 기준으로 독립 판정한 결과다. 최종 대안 선택과 시안 설계는 Phase 5에서 수행한다.

| # | 필수 검토 대상 | 실증 확인 여부 | 분류 | 기존 가설에 대한 독립 재평가 (Phase 5 검토 포인트) |
|---|---|---|---|---|
| 1 | 연구 전환기 하단 고정 & `새 연구 만들기` 위치 | 확인 (`07_research_switcher`) | `[사용성 문제]` | `모든 연구 보기` 하단 고정은 필수. 다만 `새 연구 만들기` 제거 시 연구를 자주 새로 만드는 파워 유저의 진입 단계가 +1 늘어나므로 `/r` 허브 vs `+` 메뉴 배치 트레이드오프 검토 필요. |
| 2 | 홈 화면 중복 제거 & 일정/로드맵 역할 | 확인 (`07_offline_banner`, `14_home_main`) | `[사용성 문제]` | 홈↔사이드패널 동일 할 일 3건이 다른 순서로 중복됨을 실증 확인. 단, 홈을 완전 로드맵으로 바꾸면 ‘당장 오늘 할 일’ 파악이 약해질 수 있어 “기본 패널 접힘 + 홈 거시 요약” 조합을 Phase 5에서 비교 검토. |
| 3 | 우측 레일 디자인·기본 열림·하단 버튼 | 확인 (`14_home_main`, `batch1_live.json`) | `[디자인 취향]` + `[사용성 문제]` | 1440px 기본 열림 해제는 홈 중복과 PDF 폭 축소를 동시에 해결하는 고레버리지 가설. 레일 아이콘 Fill 전환과 하단 `32×32` 비대칭 정리는 시각 완성도 핵심. |
| 4 | 페이지 제목(`h1`) 크기·굵기 불일치 | 확인 (`batch1/2_live.json`) | `[기술적 결함]` | 4가지 규격(`28/700`, `20/700`, `20/400`, 없음) 파편화 확인. 공통 `PageHeader` 표준화 필요. |
| 5 | 휴지통 이동 vs 완전 삭제 마찰 역전 | 확인 (`02_r_trash`, `03_modal_permanent_delete`) | `[사용성 문제]` | 마찰 역전 명백. 휴지통 이동을 경량화하고 완전 삭제를 연구명 입력(+복사 버튼)으로 바꾸는 가설이 타당하나, 복사 버튼이 확인 마찰을 너무 낮추지 않도록 문구/동작 설계 필요. |
| 6 | 휴지통 카드 `복원`·`완전히 삭제` 배치 | 확인 (`02_r_trash`) | `[사용성 문제]` | 인접 배치·회색 톤 확인. 좌우 분리 + 위험 톤 적용이 명확하며, 아이콘 단독 + 호버 텍스트는 터치/접근성 환경에서 발견성 저하 우려가 있어 Phase 5에서 A/B 비교 필요. |
| 7 | `SlideToConfirm` 드래그 마감·텍스트 겹침 | 확인 (`motion/slide_delete_25/50/72`) | `[기술적 결함]` | 직선 끊김과 라벨 겹침 연속 프레임으로 확정. 슬라이더를 유지하든 완전 삭제를 타이핑으로 전환하든 `공유 설정` 모달 등 잔존 사용처를 위해 컴포넌트 자체 수정 필요. |
| 8 | 모달 카피 과잉 & `✕`/`취소` 중복 | 확인 (`03_modal_permanent_delete`, `04_recording_ui`) | `[사용성 문제]` + `[디자인 취향]` | 3~4줄 장문과 슬라이더 모달 내 `✕`+`취소` 중복 확인. 일반 폼 모달은 `취소` 유지가 안전하므로 ‘주 확인 버튼 유무’에 따른 모달 버튼 규칙 분리 검토. |
| 9 | 홈 알림 카드 좌측 파란 띠 | 확인 (`06_home_long`, `07_offline_banner`) | `[디자인 취향]` | 기능 문제는 없으나 브랜드 톤 저해(“AI 티”) 분명. 절제된 표면/아이콘 강조로 대체 검토. |
| 10 | `투고까지 D-83` 칩 수직 중앙 정렬 | 확인 (`06_home_long`) | `[기술적 결함]` | 미세 정렬 편차 확인. 공통 Badge/Chip 라인하이트 점검 필요. |
| 11 | `[기록 정리하기]` 등 UX 라이팅 | 확인 (`06_home_long`) | `[사용성 문제]` | 행동 대상이 불분명함 확인. “미팅에서 할 일 정리하기” 등 목적어 명시 필요. |
| 12 | 연구 도우미 `제안`·`실행 내역` 탭 필요성 | 확인 (`13_assistant_suggestions`, `13_assistant_runs`) | `[사용성 문제]` | 탭 분리에 따른 맥락 단절 확인. 다만 비동기 장기 실행 이력을 한곳에서 추적할 필요가 있을 수 있어 ‘인라인 통합 vs 접기 드로어’ 비교 필요. |
| 13 | 연구 도우미 빈 상태 추천 프롬프트 | 확인 (`12_assistant_chat` vs `d19_pdf_v2`) | `[사용성 문제]` | PDF 상세(3개) 대비 홈(1개)의 불균형 확인. 화면·연구 단계별 3~4개 조합 추천 확장 타당. |
| 14 | 잔액 크레딧 표기 (`19,190크레딧` vs `%`) | 확인 (`12_assistant_chat`, `31_settings_usage`) | `[사용성 문제]` | 원시 크레딧 노출 확인. `%` 단독 표기는 절대량 궁금증을 남길 수 있으므로 `% 주 표기 + 호버/상세 크레딧` 절충안 검토. |
| 15 | 의견 수집(`mailto:` → 인앱/UT 수집) | 확인 (`14_home_main`, `SideRail.tsx`) | `[사용성 문제]` | 외부 이탈 확인. 인앱 모달 + 현재 라우트/메타 자동 첨부 구조로 전환 타당. |
| 16 | 설정 화면 전반 완성도 | 확인 (`31_settings_*` 10탭) | `[사용성 문제]` + `[디자인 취향]` | 10탭 구조는 유효하나 우측 레이아웃 밀도와 시각 위계 개선 여지 큼. |
| 17 | 공개 랜딩/소개 페이지 완성도 | 확인 (`33_public_*`) | `[디자인 취향]` | 기본 완성도는 준수하나 브랜드 신뢰감·히어로 리듬 보강 여지 확인. |
| 18 | 기존 독립 검수 주요 결함(MA-01~24) | 확인 (`metrics/`, `live-desktop/`, `live-mobile/`) | `[기술적 결함]` + `[사용성 문제]` | MA-01(11px 거터), MA-09(대비), MA-15(로그아웃 길게 누르기), MA-20(검토 폭 — 패널 닫힘 시 `504×652px`로 완화됨 확인) 등 현행 유효 여부를 재분류 완료. |
