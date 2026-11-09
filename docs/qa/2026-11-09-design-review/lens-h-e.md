# 렌즈 H(기능 연결)·E(위계·페이지 머리) 검토 — 마진 apps/home-preview
> 이 부록은 코드만 읽어 작성했어요(작성 시점에는 렌더링 없음). 이후 데모 모드 실제 화면(헤드리스 Chrome)과 계산된 스타일로 막힘·높음과 [추측] 항목을 다시 확인했고, 판정은 각 항목의 `- 반박 검증:` 줄과 [보고서 본문](../2026-11-09-design-review.md) §5에 적었어요.


- 방식: 소스 정적 읽기만 함(Node 없음). 화면을 띄우거나 시각으로 확인한 것은 하나도 없음. 아래 `[코드 확인]`은 코드에서 동작·구조를 직접 확인했다는 뜻이고, 실제로 어떻게 보이는지는 확인하지 않았음. `[추측]`은 코드만으로 확정할 수 없는 판단.
- 기준: AGENTS.md, docs/product/information-architecture.md(§4 화면 목록, §6 "저장·취소 뒤 위치", §8 "직접 링크로 열어도 … 목록 복귀 시 기존 찾기 조건 유지"), docs/product/user-flow.md, docs/design/ux-writing.md(§4·§5·§6), CHANGELOG Unreleased.
- 경로 기준: `apps/home-preview/src/` 아래 상대 경로.
- 공통 부품: `PageHeader`(components/common.tsx:20-41, 슬롯은 eyebrow·title·description·actions뿐이고 eyebrow는 어디서도 쓰지 않음), `Segments`(components/experience.tsx:138-172, Montage SegmentedControl), `Tabs`(components/ui/tabs.tsx:10-50, Montage Tab), `WorkTabs`(pages/student/shared.tsx:454-475, 피드백·할 일·수정 결과 사이를 경로로 이동), `BackLink`(shared.tsx:368-381), `Button` 매핑(components/ui/button.tsx:19-27: variant 없음 = solid primary, outline = outlined assistive, ghost = TextButton assistive, link = TextButton primary).

---

## H-0. 연결 표(화살표마다)

판정: 있음 / 찾기 어려움 / 한 방향 / 없음. "되돌아가기"는 앞으로 간 화면에서 출발한 기록으로 돌아오는 경로를 말함.

| 화살표 | 앞으로 가는 경로(근거) | 되돌아오는 경로(근거) | 판정 |
|---|---|---|---|
| 미팅 준비 → 할 일 | 미팅 준비 탭의 할 일 줄 → `/tasks/:id` (MeetingsPage.tsx:844-876). 준비 편집 대화상자에서 **기존** 할 일만 체크로 고름(1244-1268). 할 일이 없으면 "할 일 메뉴에서 만들 수 있어요"라는 글만 있고 링크·버튼이 없음(1269-1273) | 할 일 상세 "준비에 포함한 미팅" → `/meetings/:id?tab=prepare` (TasksPage.tsx:262-290), "미팅 준비에 포함" 버튼(TasksPage.tsx:212-219) | 연결은 양쪽 다 있음. **미팅 안에서 할 일을 새로 만들 수는 없음** |
| 미팅 결정 → 할 일 | 결정 사항은 글만 보여 주고 행동이 없음(MeetingsPage.tsx:1133-1147). 할 일 직접 만들기도 없음 | — | **없음** |
| 미팅 기록 → 피드백 | "저장한 피드백" 줄 → `/feedback/:id` (MeetingsPage.tsx:1080-1096) | 피드백 상세 LinkChip "미팅 기록 열기" → `?tab=record` (FeedbackPage.tsx:385-391) | 있음 |
| 피드백 → 수정 방법 | 같은 화면 안 섹션: 직접 작성(ghost)·AI 제안(outline) (FeedbackPage.tsx:396-425) | 같은 화면 | 있음 |
| 수정 방법 → 할 일 | "할 일로 만들기" FormDialog → 저장 뒤 `/tasks/:id` (FeedbackPage.tsx:794-848, 824) | 할 일 상세 "관련 기록 > 피드백" (TasksPage.tsx:233-251). 수정 방법은 글만 보이고 링크가 없음(252-262) | 있음(돌아올 때는 수정 방법까지가 아니라 피드백까지만 감) |
| 피드백 → 할 일(직접 추가) | "추가" Link → `/tasks?feedback=…&new=1`, 목록 화면으로 이동한 뒤 대화상자가 열림(FeedbackPage.tsx:538-545, TasksPage.tsx:92-97), 저장하면 할 일 상세로 감(555) | 할 일 상세 → 피드백 링크 | 있음. 다만 출발한 피드백으로 돌아오지 않음(IA §6 U03 "작업 저장 후 원래 위치"와 다름) |
| 피드백 → 수정 결과 | 피드백 화면에 머문 채 ResultEditorDialog가 열림(FeedbackPage.tsx:577-594) | 결과 상세 "연결한 피드백" (ResultsPage.tsx:167-186) | 있음 |
| 할 일 → 수정 결과 | "작성" Link → `/results?task=…&new=1` (TasksPage.tsx:292-299). 수정 결과 목록으로 넘어간 뒤 저장하면 결과 상세로 감(ResultsPage.tsx:332) | 결과 상세 "연결한 할 일" (ResultsPage.tsx:218-238) | 있음. 다만 **피드백과 동작이 다름**(피드백은 그 자리, 할 일은 화면을 떠남) |
| 할 일 → 글쓰기 | 할 일 상세의 관련 기록에 문서가 없음(TasksPage.tsx:231-320) | 문서 편집기에도 할 일·피드백 연결이 없음(WritingPage.tsx:477-540) | **없음(양쪽 다)** |
| 글쓰기 → 검토 요청 | "검토용 PDF" → 미리보기 → "등록하고 수정 결과 쓰기" → `/results?new=1&version=` (WritingPage.tsx:516-529, 940-985) → 결과 상세 "검토 요청 만들기" → `/reviews?result=` (ResultsPage.tsx:110-118, ReviewsPage.tsx:96) | 검토 상세 → 수정 결과(recheck 대화상자 안, ReviewDetailPage.tsx:1181-1187) → 자료 버전(ResultsPage.tsx:136-140). 거기서 **문서로 돌아가는 길은 없음** | **찾기 어려움 + 한 방향** |
| 검토 요청 → 교수 결과 | 만들기 성공 → `/reviews/:id`, "링크 복사"(ReviewsPage.tsx:197-200, ReviewDetailPage.tsx:528-531). 교수는 링크로 들어옴(RmsApp.tsx:231-237) | 학생: 알림 → `/reviews/:id?item&round` (notifications.ts:128-130), 홈 "확인할 내용"(HomePage.tsx:535-550), 목록에 "추가 수정 필요 n개"(ReviewsPage.tsx:296-306) | 있음 |
| 교수 결과 → 수정 결과(반영 기록) | 학생 화면의 응답 아래에는 안내 글만 있음(ReviewDetailPage.tsx:881-884). 수정 결과로 가는 링크는 **"다시 확인 요청" 대화상자 안에만** 있음(1181-1187) | 결과 상세의 "검토 요청" 칸에는 제목·이메일만 있고 교수 결과가 없음(ResultsPage.tsx:193-206). 피드백 화면에는 검토 정보가 전혀 없음(FeedbackPage.tsx에 review 참조 0건) | **찾기 어려움 + 한 방향** |
| 자료 버전 ↔ 글쓰기 | 글쓰기 → 자료: PDF 등록(WritingPage.tsx:947-971, 자료에 문서 참조를 저장하지 않음) | 자료 상세 "이 버전을 사용한 기록"은 수정 결과·미팅만 보여 줌(MaterialsPage.tsx:487-530) | **한 방향** |
| 글쓰기 → 연구 도우미(AI 검토) | `navigate(/assistant?mode=review_writing&document=…)` (WritingPage.tsx:688-715) | ResearchAssistant.tsx에 `<Link`·`to=`가 한 곳도 없음. 선택 뒤에는 토스트만 뜸(498) | **한 방향(막다른 곳)** |
| 시간 조율 → 미팅 | 확정되면 "확정한 미팅 열기"(PlanningPage.tsx:1033-1040). 캘린더 날짜를 누르면 `/meetings?new=1&date=` (422, MeetingsPage.tsx:97-104) | 조율 화면 "돌아가기" → `/planning?tab=schedule` 또는 `/r` (PlanningPage.tsx:911-921) | 있음 |

출발 위치를 기억하는 장치(`?from=`, `returnTo` 등)는 코드 어디에도 없음(검색 결과 0건). 되돌아가는 길은 모두 상세 화면의 `BackLink`(목록으로 고정)나 상대 기록 링크에 기대고 있음. [코드 확인]

## H-0b. 진입점별 도착지

| 진입점 | 도착지(근거) |
|---|---|
| ⌘K 팔레트 (lib/command-items.ts) | 빈 입력: 최근 기록 5개(88-101). 기록 검색 대상은 문서·미팅·피드백·할 일·자료·수정 결과(42-49). **검토 요청·시간 조율은 대상이 아님**. 만들기: 미팅 `meetings?new=1`, 할 일 `tasks?new=1`, 글 `writing?new=1`, 연구 `/r?new=1`(119-150). **피드백 추가·자료 등록·수정 결과 작성·검토 요청 만들기는 없음**. 이동: 7개 메뉴 + 할 일·수정 결과·연구 도우미·연구 설정·내 연구·계정 설정·사용 안내(152-197). 다른 연구, 테마 |
| G+글자 (lib/go-shortcuts.ts:6-18) | H 홈, P 계획·일정, M 미팅, W 글쓰기, F 피드백, D 자료, R 검토 요청 목록, T 할 일, A 연구 도우미, S 연구 설정. 연구 안에서만 켜짐(use-go-shortcuts.ts:21). 수정 결과(G+?)는 없음 |
| 홈 주간 띠 (components/home/WeekStrip.tsx) | 미팅 → `/meetings/:id`, 할 일 마감 → `/tasks/:id` (lib/week-strip.ts:64, 82). 빈 날은 "이날은 미팅도 마감도 없어요."만 있고 행동이 없음(192-194). 계획·일정 큰 캘린더로 가는 링크도 없음 |
| 홈 '확인할 내용' (HomePage.tsx:520-585) | 읽지 않은 교수 응답·댓글 → `/reviews/:id?item&round`, AI 제안 → `/assistant?tab=overview`, 주요 목표 마감 → `/planning`(특정 목표를 지정하지 않음) |
| 알림 판 (WorkspaceShell.tsx:513-624) | 활동 이벤트 → `e.href`(서버가 정한 기록 주소), 교수 응답·댓글 → `notificationHref`. 필터는 "읽지 않음/전체"(Segments). 검토 알림은 "전체"에서도 읽지 않은 것만 보임(583-613) |
| 빈 화면(EmptyState = Montage FallbackView) | 미팅 목록 → 미팅 만들기(MeetingsPage.tsx:251-275), 피드백 → 피드백 추가(FeedbackPage.tsx:173-185), 수정 방법 → 직접 작성(495-503), 할 일 → 조건 초기화/할 일 추가(TasksPage.tsx:505-522), 수정 결과 → 작성(ResultsPage.tsx:311-323), 자료 → 자료 등록(MaterialsPage.tsx:619-645, 보관함은 행동 없음), 검토 요청 → 수정 결과 작성 또는 검토 요청 만들기(ReviewsPage.tsx:247-272), 글쓰기 → 계획서 만들기(WritingPage.tsx:249-258), 로드맵 → 기본 단계로 시작(PlanningPage.tsx:172-197), 연구 목록 → 연구 만들기(AuthPages.tsx:493-514). 상세 화면의 "열 수 없어요"는 위에 BackLink가 있음. **행동이 없는 것**: 결정 사항(MeetingsPage.tsx:1149-1152), 질문(1215), 검토 항목 없음(ReviewDetailPage.tsx:627-632), 홈 연구 없음(HomePage.tsx:35, Shell이 먼저 걸러서 실제로는 거의 안 보임) |

## H-0c. 막다른 곳 목록

1. **교수 검토 화면, 결과를 저장한 뒤** — 토스트 "이 항목의 검토 결과를 저장했어요."만 뜨고, 양식은 "내 응답 변경"으로 바뀌어 그대로 남음(ReviewDetailPage.tsx:319-334, 791-793). 다음 항목 버튼, 남은 항목 수, 모두 끝냈다는 안내가 없음. 나가는 길은 로고 링크(`/r`, aria "마진(Margin) 홈") 하나(487-499). → H-3
2. **연구 도우미** — 선택하면 "나만 볼 수 있는 기록으로 저장했어요" 토스트만 뜨고 어디에 저장됐는지 링크가 없음(ResearchAssistant.tsx:491-498). 글쓰기에서 'AI 검토'로 들어오면 문서로 돌아갈 길이 없음(화면 전체에 Link가 0개). → H-4
3. **미팅 준비 편집 대화상자, 할 일이 0개일 때** — 안내 글만 있음(MeetingsPage.tsx:1269-1273).
4. **결정 사항 줄** — 할 일·질문으로 이어 갈 행동이 없음(MeetingsPage.tsx:1133-1147).
5. **자료 상세 "이 버전을 사용한 기록"** — 문서와 검토 요청이 빠져 있음(MaterialsPage.tsx:487-530).
6. **검토 상세(학생), 교수가 '추가 수정 필요'를 남긴 뒤** — 다음 행동은 대화상자 안에 숨어 있음. → H-1
7. **교수가 시간 조율을 저장한 뒤** — 토스트만 뜸. "돌아가기"를 누르면 `/r`로 가는데, 받은 검토가 없는 교수에게는 "진행 중인 연구가 없어요 + 연구 만들기" 화면이 나옴(PlanningPage.tsx:911-921, AuthPages.tsx:179-181, 493-514). → H-6
8. **수정 결과 상세, '검토 요청 만들기'가 비활성일 때** — 버튼 자체에는 이유가 없고 본문 안내(ResultsPage.tsx:159-163)가 따로 있음(낮음).
9. **검토 항목이 없는 검토 상세** — FallbackView에 행동이 없음(ReviewDetailPage.tsx:627-632).
10. **로그인 뒤 돌아갈 곳** — `next`가 `/r`·`/reviews`·`/schedule`일 때만 허용. `/account?tab=…`로 들어온 사용자는 `/r`로 감(AuthPages.tsx:46-49).

---

## 발견 사항 — H(기능 연결)

### [H-1] 교수의 '추가 수정 필요'에서 학생이 고치는 곳(수정 결과)으로 가는 길이 대화상자 안에 숨어 있음
- 위치: 검토 상세(학생 소유자) `/reviews/:id` · 모든 너비 · 공통 / pages/reviews/ReviewDetailPage.tsx:770-893, 1181-1187; pages/student/ResultsPage.tsx:193-206; pages/student/FeedbackPage.tsx(검토 참조 없음)
- 심각도: 높음
- 반박 검증: 확인(코드). 실제 클릭 흐름은 교수 계정이 필요해 화면 확인은 못 함.
- 무엇: 학생이 교수 응답을 보는 칸에는 응답 글과 "교수님 응답은 여기에 보여요…"라는 안내만 있음(881-884). 수정 결과로 가는 유일한 링크 "수정 결과에서 고치기"는 '다시 확인 요청'(outline sm, 661-674) 대화상자를 열어야 보임(1181-1187). 반대로 수정 결과 상세의 "검토 요청" 칸은 요청 제목·교수 이메일만 보여 주고 항목별 교수 결과는 없음(195-206). 피드백 화면에는 관련 교수 결과가 아예 없음. IA §4 S05 "관련 교수 결과를 구분"과 다름. [코드 확인]
- 왜: 핵심 흐름의 마지막 화살표(교수 결과 → 반영 기록)가 끊김. '추가 수정 필요'를 받은 학생이 무엇을 눌러야 하는지 모르고, 교수가 남긴 이유를 수정 결과를 고치면서 다시 볼 수 없음.
- 제안: 소유자이고 최신 응답이 `changes_requested`일 때 응답 카드 바로 아래에 Montage `Button`(outlined assistive, size small) "수정 결과에서 고치기"를 두고 `/r/:rid/results/:resultId`로 보냄. 수정 결과 상세의 "검토 요청" 줄에는 항목별 최신 차수와 `ResponseStatus`(helpers.tsx:100-116)를 `ContentBadge`로 붙임. 이렇게 상태를 보여 주기만 하고, 학생의 처리 상태와 교수 결과를 하나로 합치지는 않음.
- 비용: 작음(링크와 배지 표시만)
- 같은 문제가 있는 다른 곳: 피드백 상세(FeedbackPage.tsx:535-628) "수정 결과" 칸에도 이 결과가 들어간 검토 요청과 교수 결과가 보이지 않음.

### [H-2] 글쓰기에서 검토 요청까지가 3단계이고 이름으로 알아볼 수 없음. 돌아오는 길(자료 → 문서)이 없음
- 위치: 글쓰기 상세 → 자료 → 수정 결과 → 검토 요청 · 모든 너비 · 공통 / pages/WritingPage.tsx:516-529, 940-985; pages/student/MaterialsPage.tsx:487-530; pages/student/ResultsPage.tsx:110-118
- 심각도: 높음
- 반박 검증: 확인(코드).
- 무엇: 문서 머리의 "검토용 PDF"(outline)를 눌러야 PDF 미리보기 대화상자가 열리고, 거기서 "등록하고 수정 결과 쓰기"를 누르면 수정 결과 목록 위로 작성 대화상자가 열림. 저장하면 결과 상세로 가고, 거기서 "검토 요청 만들기"를 눌러야 함. 등록할 때 자료에는 원래 문서 참조를 저장하지 않음(947-952에서 제목 문자열 `· 문서 vN`에만 남음). 그래서 자료 상세의 "이 버전을 사용한 기록"에 문서가 나오지 않음. [코드 확인]
- 왜: 사용자 흐름의 "글쓰기 → 검토 요청"을 찾기 어려움. 교수 응답을 받은 학생이 원고로 돌아가 고치려 해도 자료 → 문서 경로가 없음(IA §7 "보존 자료 버전은 … 특정 버전을 참조").
- 제안: (1) 문서 머리 오른쪽 주 버튼 자리를 흐름의 다음 단계로 정리함. `Button` solid primary "검토 요청 준비"는 지금의 PDF → 등록 → 결과 작성 과정을 그대로 열고, "저장"은 자동 저장 상태 표시와 `TextButton`으로 내림(E-3 참고). (2) 자료 상세 "이 버전을 사용한 기록"에 "만든 문서" 줄(`student-simple-row`)을 추가함. 이를 위해 자료 버전에 문서 버전 참조가 필요함(DB 마이그레이션은 추가만).
- 비용: 중간(데이터 참조 추가 필요)
- 같은 문제가 있는 다른 곳: 검토 상세(교수·학생)에서 원본 문서로 가는 링크가 없음.

### [H-3] 교수 검토 화면: 결과를 저장한 뒤 다음 할 일·끝을 알려 주지 않음
- 위치: `/reviews/:requestId`(교수) · 모든 너비, 특히 ≤767 · 공통 / pages/reviews/ReviewDetailPage.tsx:307-334, 487-499, 591-616, 785-878; pages/reviews/reviews.css:1070-1085, 1198-1206
- 심각도: 높음
- 반박 검증: 확인(코드, ReviewDetailPage.tsx 저장 뒤 toast만). 교수 화면 실제 저장은 서버가 필요해 미실행.
- 무엇: 저장에 성공하면 토스트만 뜨고 양식 제목이 "내 응답 변경"으로 바뀜. 다음 항목 버튼, "응답 전 n개" 표시, 모두 응답했다는 안내가 없음(왼쪽 목록에 항목별 `ResponseStatus`만 있음, 610-611). ≤991에서는 항목 목록이 맨 위 가로 줄이 되고, ≤767에서는 응답 양식이 '교수 응답·댓글' 탭 맨 아래에 있음. 그래서 다음 항목으로 가려면 위로 올라가 가로로 넘겨야 함. 나가는 길은 로고 링크(`/r`)뿐. [코드 확인] 레이아웃이 실제로 어떻게 보이는지는 [추측]
- 왜: 교수는 링크로 한 번 들어와 항목마다 결과를 남기는 사용자임(AGENTS 제품 불변 조건). 일이 끝났는지, 몇 개가 남았는지 판단할 근거가 없음.
- 제안: 저장에 성공하면 양식 아래에 상태 줄을 둠: "응답 전 항목 n개" + `Button` solid primary "다음 항목"(다음 응답 전 항목으로 `selectItem`). 남은 항목이 0이면 FallbackView(compact)로 "모든 항목에 결과를 남겼어요. 학생에게 알림으로 보여요." + `TextButton` "받은 검토 요청으로". 문구에 승인·완료를 쓰지 않음(ux-writing §4). 머리 오른쪽에 "응답 n/m"을 `ContentBadge`로 표시.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 학생 소유자의 '다시 확인 요청' 저장 뒤(401-427)에도 토스트만 뜨고 공유 링크를 다시 복사하라는 안내가 없음.

### [H-4] 연구 도우미가 막다른 곳: 선택한 기록·출발한 문서로 가는 링크가 없음
- 위치: `/r/:id/assistant` · 모든 너비 · 공통 / pages/ResearchAssistant.tsx:420-501(adopt), 507-526; pages/WritingPage.tsx:688-715
- 심각도: 높음
- 반박 검증: 확인(코드·화면). 연구 도우미 캡처에 기록으로 가는 링크 없음.
- 무엇: 화면 전체에 `<Link`·`to=`가 0개(검색 결과 없음). 선택하면 피드백·수정 방법·할 일·질문을 만들지만(420-490) 토스트만 뜨고 만든 기록으로 가는 버튼이 없음(498). 글쓰기에서 'AI 검토'로 들어오면 `?document=`를 받지만 그 문서로 돌아가는 길이 없음. 'AI 제안' 보기의 각 제안에도 원본(피드백·미팅·문서)으로 가는 링크가 없음(608-655). [코드 확인]
- 왜: AI 결과는 사용자가 선택해서 자기 기록으로 남기는 것인데(AGENTS), 남긴 뒤 어디 있는지 모름. 문서를 고치던 흐름이 끊김.
- 제안: 선택에 성공하면 sonner 토스트에 action(이미 Montage Toast 모양으로 바꿈, CHANGELOG)을 붙여 "열기" → 만든 기록 주소로 보냄. `?document=`가 있으면 PageHeader 위에 `BackLink` "문서로 돌아가기"(또는 E 제안의 `back` 슬롯). 각 제안 줄에 `TextButton` "원본 보기".
- 비용: 작음
- 같은 문제가 있는 다른 곳: 미팅 기록·피드백 상세 안의 AIWorkbench(MeetingsPage.tsx:1100-1110, FeedbackPage.tsx:614-626)는 같은 화면이라 해당 없음.

### [H-5] 미팅 결정과 준비에서 할 일을 새로 만들 수 없음(핵심 흐름의 첫 화살표가 없음)
- 위치: 미팅 상세 결정·질문 탭, 준비 편집 대화상자 · 모든 너비 · 공통 / pages/student/MeetingsPage.tsx:1120-1152, 1244-1273
- 심각도: 높음
- 반박 검증: 확인(코드). MeetingsPage.tsx:1271 ‘아직 할 일이 없어요. 할 일 메뉴에서 만들 수 있어요.’
- 무엇: 결정 사항은 글과 출처만 보여 줌. 준비 편집에서는 기존 할 일만 체크로 고를 수 있고, 할 일이 없으면 "할 일 메뉴에서 만들 수 있어요."라는 글만 나옴. 미팅에서 할 일로 바로 이어지는 길은 피드백 → 수정 방법 → 할 일로 돌아가는 것뿐. [코드 확인]
- 왜: 사용자 흐름 §5 "할 일과 다음 미팅 준비", IA §6 U03 "미팅 준비에서 시작하면 그 미팅을 유지해 연결"과 다름. 미팅 직후 정한 일을 바로 할 일로 남길 수 없음.
- 제안: 결정 줄 오른쪽에 `TextButton`(assistive, small) "할 일로 만들기" → FeedbackPage의 할 일 FormDialog를 다시 써서 저장할 때 `meeting.taskIds`에 추가하고 같은 미팅에 머묾. 준비 편집 대화상자의 할 일 목록 아래에 `Button` outlined small "새 할 일"(목록 안에서 바로 입력).
- 비용: 중간
- 같은 문제가 있는 다른 곳: 할 일 상세 "미팅 준비에 포함" 대화상자에서 미팅이 없을 때 "먼저 미팅 만들기"를 누르면 미팅 목록으로 가고 원래 할 일로 돌아오지 않음(TasksPage.tsx:794-803).

### [H-6] 교수가 화면 밖으로 나가는 곳이 학생용 화면(연구 만들기·AI 사용량)임
- 위치: `/r`(교수 계정), 교수 시간 조율 `/schedule/:pollId` · 모든 너비 · 공통 / pages/AuthPages.tsx:172-181, 243-256, 335-347, 493-514; components/WorkspaceShell.tsx:195-201, 378-401; lib/command-items.ts:119-127; pages/PlanningPage.tsx:911-921
- 심각도: 보통
- 무엇: `incomingOnly`는 공유 중인 검토가 있을 때만 참임. 시간 조율 초대만 받은 교수는 `/r`에서 제목 "내 연구", 빈 화면 "진행 중인 연구가 없어요" + solid "연구 만들기"를 봄. 셸에는 'AI 사용량' 카드와 ⌘K '새 연구 만들기'가 항상 있음. 조율 화면의 "돌아가기"도 연구가 없으면 `/r`로 감. [코드 확인]
- 왜: 교수는 지정된 검토와 일정 조율에만 접근함(AGENTS). 학생용 행동을 주 버튼으로 보여 주면 잘못 누르기 쉬움. 이것은 교수용 대시보드 추가가 아니라 기존 목록의 이름과 버튼을 바로잡는 일임.
- 제안: `incomingOnly` 조건에 "열린 조율의 참여자"를 포함하고 제목을 "받은 요청"으로 바꿈. 연구가 0개인 교수에게는 셸에서 AI 사용량 카드와 ⌘K '새 연구 만들기'를 숨김. 조율 화면의 "돌아가기"는 `BackLink` "받은 요청"으로 바꿈.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 교수 검토 화면 로고 링크의 aria "마진(Margin) 홈"(ReviewDetailPage.tsx:494-498)도 실제 도착지(받은 요청 목록)와 다름.

### [H-7] 출발한 곳으로 돌아가지 않음(목록으로 고정된 BackLink, 할 일·결과 작성이 화면을 떠남)
- 위치: 피드백·할 일·수정 결과·자료·미팅 상세 · 모든 너비 · 공통 / pages/student/shared.tsx:368-381; TasksPage.tsx:292-299; FeedbackPage.tsx:538-545; ResultsPage.tsx:332
- 심각도: 보통
- 무엇: 모든 상세 화면의 `BackLink`는 자기 목록 주소로 고정돼 있음. 그래서 피드백 → 할 일로 들어간 뒤 "← 할 일 목록"을 누르면 피드백이 아니라 할 일 목록으로 감. 목록의 찾기·필터는 `useState`라서 돌아오면 초기화됨(FeedbackPage.tsx:55-56, TasksPage 필터 상태, ResultsPage.tsx:24-25. 미팅만 `?status=`로 유지, MeetingsPage.tsx:86-91). 피드백의 결과 작성은 그 자리에서 열리는데 할 일의 결과 작성은 결과 목록으로 넘어감. [코드 확인]
- 왜: IA §4 하단 "관련 기록에서 시작한 편집은 그 기록으로 복귀", IA §8 "목록 복귀 시 기존 찾기 조건을 유지"와 다름.
- 제안: 공통 `?from=` 경로(앱 내부 주소만 허용)를 두고, `BackLink`가 있으면 "← {출발 기록 이름}"으로 바꿈. 할 일 상세의 결과 작성은 FeedbackPage처럼 `ResultEditorDialog`를 그 자리에서 엶. 목록 필터·검색은 미팅처럼 search params로 옮김.
- 비용: 중간
- 같은 문제가 있는 다른 곳: 자료 상세 → 미팅 준비, 홈 → 할 일 추가(`tasks?new=1` 저장 뒤 할 일 상세로 감, TasksPage.tsx:555).

### [H-8] ⌘K 팔레트에 핵심 흐름 중간 단계 만들기와 검토 요청 찾기가 없음
- 위치: ⌘K · ≥768(키보드) · 공통 / lib/command-items.ts:42-49, 119-150, 152-197
- 심각도: 낮음
- 무엇: '만들기' 묶음은 미팅·할 일·글·연구 4개. 이미 `?new=1`을 받는 수정 결과(ResultsPage.tsx:60)와 피드백 추가·자료 등록·검토 요청 만들기는 빠져 있음. 기록 검색 대상에도 검토 요청·시간 조율이 없음. G 단축키에도 수정 결과가 없음(go-shortcuts.ts:6-18). [코드 확인]
- 왜: 진입점이 흐름의 앞쪽(미팅·할 일)에만 몰려 있고, 뒤쪽(결과·검토)을 키보드로 찾을 수 없음.
- 제안: createEntries에 "수정 결과 작성 → results?new=1", "검토 요청 만들기 → reviews?…"(ReviewsPage에 `?new=1` 처리 추가 필요)를 추가함. RECORD_KINDS에 reviews(`/reviews/:id`)를 추가함.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 사이드바 툴팁 단축키(WorkspaceShell.tsx:316).

### [H-9] 홈 주간 띠: 빈 날에 행동이 없고 큰 캘린더로 가는 길이 없음
- 위치: 연구 홈 · 모든 너비 · 공통 / components/home/WeekStrip.tsx:121-145, 192-194
- 심각도: 낮음
- 무엇: 날짜를 골라도 일정이 없으면 "이날은 미팅도 마감도 없어요."만 나옴. 계획·일정 캘린더는 `meetings?new=1&date=`를 이미 지원함(PlanningPage.tsx:421-423). [코드 확인]
- 왜: 날을 골라 미팅을 잡으려는 행동이 막힘.
- 제안: 빈 날 문구 오른쪽에 `TextButton`(primary, small) "이날 미팅 만들기" → `meetings?new=1&date=`. 머리의 '오늘' 옆에 `TextButton` "캘린더" → `/planning?tab=calendar`.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 홈 '확인할 내용'의 주요 목표 마감 링크가 특정 목표가 아니라 `/planning` 전체로 감(HomePage.tsx:580).

### [H-10] 할 일과 글쓰기가 서로 연결되지 않음
- 위치: 할 일 상세, 문서 편집기 · 모든 너비 · 공통 / pages/student/TasksPage.tsx:231-320; pages/WritingPage.tsx:477-540; lib/domain.ts:160-192
- 심각도: 보통
- 무엇: 할 일의 "관련 기록"은 피드백·수정 방법·미팅·수정 결과만 보여 줌. 문서 쪽에도 할 일·피드백 표시가 없음. 데이터에서 문서를 참조하는 것은 Milestone.documentIds 하나뿐. [코드 확인] 이 연결이 꼭 필요한지는 [추측]
- 왜: 핵심 흐름 "할 일 → 글쓰기"를 사용자가 직접 메뉴를 옮겨 다니며 이어야 함.
- 제안: 최소안: 할 일 상세 "관련 기록" 아래에 `TextButton` "글쓰기 열기"(최근 문서 또는 목록). 확장안: 할 일에 문서 참조를 추가함(마이그레이션은 추가만).
- 비용: 작음(최소안) / 중간(확장안)
- 같은 문제가 있는 다른 곳: 피드백 상세에도 문서 링크가 없음.

---

## E-0. 화면별 머리 구조

"행동" 칸은 머리 영역 버튼 수(solid primary 수). "찾기"는 목록 위 찾기 칸. 근거 줄은 표 아래에 적음.

| 화면 | 상단 줄 | 제목 | 설명 | 행동(버튼 수, 주 버튼 수) | 탭 | 보기 전환 | 찾기 | 기타 |
|---|---|---|---|---|---|---|---|---|
| `/` 소개 | 공개 헤더(로고·메뉴·로그인·시작하기 어두운 버튼) | h1 슬로건 2줄 | 1문단 | 2(시작하기 어두운 버튼 1 + 사용 방법 보기) | — | — | — | PublicPages.tsx:105-138, 352-375 |
| `/features` | 공개 헤더 | h1 "미팅부터 교수 검토까지" | 있음 | 사용 안내 링크 1 | 기능 4개 버튼(aria-pressed, role=group) | — | — | 서로 다른 내용 묶음인데 탭 역할이 아님(789-800) |
| `/pricing` | 공개 헤더 | h1 "연구 방식에 맞는 플랜" | 있음 | 자주 묻는 질문 링크 | — | — | — | 849, 862 |
| `/guide` | 공개 헤더 | h1 "마진 사용 안내" | 있음 | 맨 아래 CTA 1(rms-action primary) | — | — | — | 1032, 1110 |
| `/login` | 소개 영역 | h1 | 대상에 따라 다른 문구 | 로그인 solid 1 | — | — | — | AuthPages.tsx:79-122 |
| `/signup` | 공개 헤더 | h1 | 미리보기 안내 | 단계 버튼 solid 1, 완료 뒤 2 | — | — | — | PublicPages.tsx:882-1010 |
| `/r` 내 연구 | 셸 topbar("내 연구") | PageHeader "내 연구"/"받은 검토 요청" | 있음 | 1(1) 연구 만들기 | — | Segments 진행 중·보관함·휴지통 | 없음 | 받은 검토·초대·조율 줄이 연구 목록 위에 쌓임. AuthPages.tsx:243-372 |
| `/account` | topbar "계정 설정" | 직접 만든 h1(settings-heading) | 없음 | 0 | 옆 메뉴 버튼 5개(aria-current=page) | — | — | SettingsPage.tsx:114-135 |
| 연구 홈 | topbar 연구명 › 연구 홈 | 직접 만든 h1 = 연구명(rh-intro) | 연구 설명 | 머리 0. 본문 solid 1(rh-primary "미팅 준비하기") + 바로 시작 카드 3 | — | Segments(공동연구일 때) 내 할 일/연구 전체 | — | HomePage.tsx:114-185, 363-367, 399-409 |
| 계획·일정 | topbar | PageHeader | 있음 | 1(1). 이름이 탭에 따라 바뀜 | **Segments**로 로드맵·캘린더·시간 조율 | Segments 시간순·관계도(로드맵에서만) | — | PlanningPage.tsx:121-158 |
| 미팅 목록 | topbar | PageHeader "미팅" | 있음 | 1(1) | — | FilterSegments 5개(필터) | SearchInput | MeetingsPage.tsx:177-200 |
| 미팅 상세 | topbar + BackLink "미팅 목록" | PageHeader 미팅 이름 | 날짜·시간 | 2(0): StatusBadge + outline 편집 | Tabs 준비·기록·결정·질문 | — | — | VisibilityField가 머리와 탭 사이에 있음. MeetingsPage.tsx:733-789 |
| 글쓰기 목록 | topbar | PageHeader "글쓰기" | 있음 | 2(1): outline 원고 만들기 + solid 계획서 만들기 | — | — | **없음** | WritingPage.tsx:142-160 |
| 글쓰기 상세 | topbar + TextButton "← 글쓰기" | 직접 만든 제목 입력 칸 | 저장 상태·글자 수 | 3(1): 버전·검토용 PDF outline, 저장 solid. 도구 줄에 'AI 검토' solid sm이 하나 더 | — | 버전 대화상자 안 Segments | — | WritingPage.tsx:477-533, 688 |
| 피드백 목록 | topbar + **WorkTabs(제목 위)** | PageHeader "피드백" | 있음 | 1(1) | WorkTabs | FilterSegments 5개 | SearchInput | FeedbackPage.tsx:102-127 |
| 피드백 상세 | topbar + BackLink (WorkTabs 없음) | PageHeader 피드백 제목 | 출처 미팅 | 1(0) outline 편집 | — | — | — | 주 행동이 본문 섹션 안에 있음(416-425). 331-353 |
| 수정 결과 목록 | topbar + WorkTabs | PageHeader | 있음 | 1(1) | WorkTabs | Segments 전체·검토 요청 전·포함(필터) | SearchInput | ResultsPage.tsx:94, 245-271 |
| 수정 결과 상세 | topbar + WorkTabs + BackLink | PageHeader | 고정 문구 | 2(1): outline 편집 + solid 검토 요청 만들기(비활성 가능) | WorkTabs | — | — | ResultsPage.tsx:94-120 |
| 할 일 목록 | topbar + WorkTabs | PageHeader | 있음 | 1(1) | WorkTabs | Segments 상태 4개 | SearchInput + 선택 상자 2 + 개수 | TasksPage.tsx:154, 352-410 |
| 할 일 상세 | topbar + WorkTabs + BackLink | PageHeader | 고정 문구 | 1(0) outline. 본문에 solid "완료로 표시" | WorkTabs | — | — | 제목 위로 3줄. TasksPage.tsx:154-171, 200-219 |
| 자료 목록 | topbar | PageHeader | 있음 | 1(1) | — | MaterialFolders + FilterSegments | SearchInput | MaterialsPage.tsx:539-571 |
| 자료 상세 | topbar + BackLink | PageHeader | 종류·형식 | 2(1): outline 편집 + solid 새 버전 추가 | — | — | — | 폴더 선택 상자가 머리 바로 아래. MaterialsPage.tsx:297-330 |
| 검토 요청 목록 | topbar | PageHeader | 있음 | 1(1) | — | Segments 공유 상태(필터) | **Input**(검색 아이콘 없음) | ReviewsPage.tsx:210-246 |
| 연구 도우미 | topbar | PageHeader | 있음 | actions 칸에 **알약 표시**(버튼 아님) | **Segments**로 대화·AI 제안·사용량(label 없음) | — | — | ResearchAssistant.tsx:507-526 |
| 연구 설정 | topbar | 직접 만든 h1 + 연구명 p | — | 0 | 옆 메뉴 버튼 4개 | — | — | SettingsPage.tsx:437-466 |
| 교수 `/reviews/:id` | 자체 머리(로고 → `/r`) | h1 요청 제목 | "학생이 보낸 수정 결과 · 시각" | 교수: 새로고침 outline + 아바타 메뉴(0). 학생: 새로고침·공유 설정 outline + 링크 복사 solid(1) | ≤767에서만 Tabs 수정 내용·파일 / 교수 응답·댓글 | 차수 선택 상자 | — | 학생 소유자는 셸 **안에서** 이 머리가 한 번 더 보임(RmsApp.tsx:81-91). ReviewDetailPage.tsx:484-583, 688-697 |
| 교수 `/schedule/:id` | text-link "돌아가기" | PageHeader 조율 제목 | 연구명·상태 | actions 칸에 상태 배지(버튼 아님) | — | — | — | 아래쪽 solid 최대 2(가능한 시간 저장, 확정한 미팅 열기). PlanningPage.tsx:907-940, 1014-1040 |

### 3초 테스트(코드 기준 추정, 모두 [추측]: 렌더링하지 않음)

| 화면 | 처음 보일 3가지 | 하나의 주 행동 |
|---|---|---|
| `/` | 슬로건 h1, 시작하기(어두운 버튼), 데모 창 | 시작하기(→ 가입 미리보기) |
| `/r` | "내 연구" 제목, 연구 만들기, (교수·초대가 있으면) 받은 검토 줄 | 연구 카드 열기와 연구 만들기가 서로 경쟁 |
| 연구 홈 | 연구명 h1, 바로 시작 카드 3개, 연구 단계 줄 | **분명하지 않음**: 같은 곳(미팅 준비)으로 가는 링크 5개, solid는 아래쪽 '다음 미팅' 카드 안에만 있음 |
| 계획·일정 | 제목, solid(탭에 따라 이름이 바뀜), Segments 두 줄 | 탭마다 다름. 캘린더 탭에서 "시간 조율 시작"이 나오는 것은 어색함 |
| 미팅 목록 | 제목, 미팅 만들기, 필터 5개 | 미팅 만들기 |
| 미팅 상세 | 미팅 이름, 상태 배지 + 편집, 공개 범위 칸 | 탭 안에 있음. 머리에는 주 행동이 없음 |
| 피드백 목록 | 탭(피드백·할 일·수정 결과), 제목, 피드백 추가 | 피드백 추가 |
| 피드백 상세 | ← 목록, 제목 + 편집, '받은 피드백' 카드 | **분명하지 않음**: 수정 방법 정하기가 두 번째 섹션의 ghost·outline 버튼 |
| 할 일 상세 | 탭, ← 목록, 제목 | '완료로 표시'(본문 solid) |
| 수정 결과 상세 | 탭, ← 목록, 제목 + 검토 요청 만들기 | 검토 요청 만들기 |
| 자료 상세 | ← 목록, 제목, 새 버전 추가 | 새 버전 추가 |
| 글쓰기 상세 | ← 글쓰기, 제목 입력, 버튼 3개 | 저장(solid). 그런데 흐름상 다음 단계는 '검토용 PDF' |
| 검토 요청 목록 | 제목, 만들기, 필터 | 검토 요청 만들기 |
| 연구 도우미 | 제목, '나만 볼 수 있는 공간' 알약, 보기 전환 | 대화 입력 |
| 설정 두 화면 | h1, 옆 메뉴, 첫 섹션 | 섹션 안 저장 |
| 교수 검토 | 요청 제목, 항목 목록, 문서·파일 | 검토 결과 저장. 저장 뒤 다음 행동 없음(H-3) |
| 교수 조율 | 돌아가기, 제목·상태, 후보 시간 | 가능한 시간 저장 |

## 발견 사항 — E(위계·페이지 머리)

### [E-1] PageHeader에 '뒤로'·'탭' 자리가 없어 화면마다 머리를 쌓는 순서가 다름
- 위치: 피드백·할 일·수정 결과·미팅·자료 목록/상세 · 모든 너비 · 공통 / components/common.tsx:20-41; pages/student/shared.tsx:454-475; FeedbackPage.tsx:102-103, 331-332; TasksPage.tsx:154-158; ResultsPage.tsx:94-98; components/WorkspaceShell.tsx:437-456
- 심각도: 보통
- 무엇: 쌓는 방식이 4가지임. (a) WorkTabs가 **제목 위**(피드백·할 일·결과 목록), (b) WorkTabs → BackLink → 제목 3줄(할 일·결과 상세), (c) BackLink → 제목(피드백 상세, WorkTabs 없음), (d) BackLink → 제목 → 공개 범위 → Tabs(미팅 상세). 셸 topbar 경로 표시(연구명 › 화면)와 BackLink가 같은 '위로 가기'를 두 번 보여 줌. [코드 확인]
- 왜: 같은 종류의 화면인데 제목 위치가 매번 달라 첫눈에 위치를 파악하기 어려움. 탭이 제목보다 위에 있으면 탭이 화면 제목처럼 읽힘. ux-writing §6 "화면 제목은 무엇을 하는 곳인지"
- 제안: `PageHeader`에 `back?: {to,label}`, `tabs?: ReactNode`, `toolbar?: ReactNode` 슬롯을 추가해 순서를 고정함: back → 제목 줄(제목·배지·actions) → tabs → toolbar. WorkTabs는 '피드백·수정' 묶음 머리의 `tabs` 슬롯으로 옮기고 상세 화면에서는 뺌(상세는 back만 둠). topbar 경로 표시를 3단계(연구 › 미팅 › 미팅 이름)로 늘리고, ≥768에서는 BackLink를 숨기고 ≤767에서만 보여 줌.
- 비용: 중간
- 같은 문제가 있는 다른 곳: 글쓰기 상세·설정·교수 화면은 PageHeader를 쓰지 않음(E-4, E-5).

### [E-2] 서로 다른 내용 묶음을 보기 전환(SegmentedControl)으로 나눔
- 위치: 계획·일정, 연구 도우미 · 모든 너비 · 공통 / pages/PlanningPage.tsx:124-158; pages/ResearchAssistant.tsx:518-526
- 심각도: 보통
- 반박 검증: 확인(화면). 계획·일정 머리에 서로 다른 내용(로드맵·캘린더·시간 조율)을 고르는 보기 전환과 진짜 보기 전환(시간순·관계도)이 같은 모양으로 나란히 있음(shots/planning-1440-dark.png).
- 무엇: 계획·일정은 로드맵·캘린더·시간 조율을 `Segments`로 나눔. 세 화면은 내용이 다르고, 머리의 주 버튼 이름도 탭에 따라 '단계 추가'/'시간 조율 시작'으로 바뀜(125-130). 같은 줄에 진짜 보기 전환(시간순·관계도)이 같은 모양으로 붙어 있어 단계 차이가 보이지 않음. 연구 도우미의 대화·AI 제안·사용량도 같은 경우이고 `label`이 없어 기본값 "보기 선택"이 접근성 이름이 됨(experience.tsx:142). 사용량은 `/account?tab=usage`와 겹침. [코드 확인]
- 왜: 기준(탭 = 서로 다른 내용 묶음, 보기 전환 = 같은 내용을 다르게 보여 주기)과 다름. tabs.tsx:7-8의 주석과도 다름.
- 제안: 묶음 이동은 Montage `Tab`(TabList size medium, `Tabs` 래퍼)을 PageHeader `tabs` 슬롯에 둠. 시간순·관계도만 `SegmentedControl` size small로 남겨 toolbar 오른쪽에 둠. 주 버튼은 각 탭 본문 머리로 옮겨 머리 버튼 이름이 바뀌지 않게 함. 도우미의 '사용량'은 계정 설정으로 가는 `TextButton`으로 바꿈.
- 비용: 작음
- 같은 문제가 있는 다른 곳: `/features`의 기능 4개 버튼(aria-pressed, PublicPages.tsx:787-800)은 내용이 바뀌는 묶음이라 Tab 역할이 맞음. `/r`의 진행 중·보관함·휴지통은 같은 종류 기록의 범위 필터라 Segments가 맞음.

### [E-3] 머리 영역의 주 버튼 규칙이 없음(0개, 2개, 버튼이 아닌 것)
- 위치: 미팅·피드백 상세, 글쓰기 목록/상세, 연구 도우미, 교수 조율 · 모든 너비 · 공통 / MeetingsPage.tsx:737-761; FeedbackPage.tsx:336-352, 416-425; WritingPage.tsx:146-158, 503-533, 688-715; ResearchAssistant.tsx:510-514; PlanningPage.tsx:934-940
- 심각도: 보통
- 무엇: 미팅·피드백 상세는 머리에 outline '편집'만 있고, 흐름의 다음 행동(수정 방법 정하기)은 두 번째 섹션의 ghost·outline 버튼임. 글쓰기 상세는 solid가 2개(머리의 '저장' + 도구 줄의 'AI 검토' sm). 글쓰기 목록은 같은 종류인 '원고 만들기'(outline)와 '계획서 만들기'(solid)가 나란히 있음. 도우미와 조율 화면은 actions 칸에 알약·배지(버튼 아님)를 넣음. 미팅 상세의 상태 배지도 actions 칸에 있음. [코드 확인]
- 왜: 3초 안에 주 행동을 알 수 없음. 저장은 자동 저장 상태로도 보이므로(WritingPage.tsx:494-498) solid로 둘 이유가 약함.
- 제안: 규칙: 머리 actions에는 Montage `Button` solid primary를 많아야 1개(흐름의 다음 단계)와 outlined assistive 1개만 둠. 나머지는 `IconButton`(normal) "더보기" Menu로 옮김. 상태 `ContentBadge`는 제목 바로 옆(제목 줄 안)에 둠. 피드백 상세 주 버튼은 "수정 방법 정하기"(섹션으로 스크롤하거나 직접 작성을 엶). 글쓰기 상세는 '저장'을 `TextButton`이나 단축키(⌘S)로 내리고 '검토 요청 준비'(H-2)를 solid로. 글쓰기 목록은 `Button` solid "새 문서" + Menu(계획서·원고).
- 비용: 작음
- 같은 문제가 있는 다른 곳: 홈(E-6), 교수 조율 아래쪽 solid 2개(1024-1039).

### [E-4] 설정 두 화면이 PageHeader를 쓰지 않고, 옆 메뉴 버튼이 페이지 이동처럼 표시됨
- 위치: `/account`, `/r/:id/settings` · 모든 너비 · 공통 / pages/SettingsPage.tsx:114-135, 437-466
- 심각도: 낮음
- 무엇: `div.settings-heading`에 직접 만든 h1을 씀. 옆 메뉴는 `<button aria-current="page">`인데 실제로는 `?tab=` 상태만 바꿈. 연구 설정은 연구명을 설명 줄에 둠. [코드 확인] 좁은 화면에서 옆 메뉴가 어떻게 배치되는지는 확인하지 않음 [추측]
- 왜: 다른 화면과 제목 크기·여백 규칙이 갈라짐. 보조기기에서 버튼인데 '현재 페이지'로 읽혀 역할이 섞임.
- 제안: `PageHeader title="연구 설정" description={연구명}`. 옆 메뉴는 ≥992에서 `Link to="?tab=…"`(aria-current=page 유지), ≤991에서 Montage `Tab`(가로 스크롤)으로 바꿈.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 연구 설정의 '연구 단계' 탭은 계획·일정 로드맵과 겹침(SettingsPage.tsx:655에서 계획·일정으로 링크함).

### [E-5] '뒤로' 부품이 4가지
- 위치: 상세·독립 화면 · 모든 너비 · 공통 / shared.tsx:368-381(BackLink); WritingPage.tsx:479-483(TextButton "← 글쓰기"); PlanningPage.tsx:907-921(text-link "돌아가기"); ReviewDetailPage.tsx:487-499(로고 + 화살표)
- 심각도: 보통
- 무엇: 같은 '위로 가기'가 BackLink "피드백 목록", TextButton "글쓰기", "돌아가기"(목적지 없음), 로고 링크(교수에게는 화살표도 없음)로 다르게 보임. [코드 확인]
- 왜: 돌아갈 곳의 이름을 알려 주는 규칙이 화면마다 다름. '돌아가기'만으로는 어디로 가는지 모름(ux-writing §6 버튼 "누르면 일어나는 일").
- 제안: `BackLink` 하나로 통일함(Montage `TextButton` assistive small + arrow-left, 이름은 도착 화면). E-1의 `back` 슬롯으로 넣음. 교수 화면도 로고와 별도로 `BackLink` "받은 검토 요청"을 둠.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 404의 "내 연구로 이동"/"첫 화면으로"(RmsApp.tsx:239-251, 345-357).

### [E-6] 연구 홈: 같은 곳으로 가는 행동이 5개이고 주 행동이 아래쪽에 있음
- 위치: 연구 홈 · 모든 너비 · 공통 / pages/HomePage.tsx:114-185, 196-246, 290-367, 520-585
- 심각도: 보통
- 무엇: `meetings/:id?tab=prepare`로 가는 링크가 바로 시작 카드(160-172), 미팅 제목(291), 할 일·자료·질문 링크(354, 358), solid "미팅 준비하기"(363-367)로 5개. 첫 화면 위쪽은 연구명 h1, 바로 시작 카드 3개, 연구 단계 줄이 차지하고 solid는 그 아래 '다음 미팅' 카드 안에 있음. ≥1200에서 '확인할 내용'(교수 응답)은 오른쪽 열에 있음. [코드 확인] 첫 화면에 실제로 어디까지 보이는지는 [추측]
- 왜: ux-writing §3② "한 화면에 핵심 메시지 하나". 교수 응답처럼 지금 확인해야 할 내용이 다른 링크들과 같은 무게로 보임.
- 제안: 홈 머리를 `PageHeader title={연구명} description="현재 단계 · 다음 미팅 D-n"`으로 정리하고, actions에 상황별 solid 1개(기록 중이면 "피드백 기록하기", 아니면 "미팅 준비하기")를 둠. 바로 시작은 secondary 목록(`TextButton`)으로 줄이고 다음 미팅 카드의 solid는 outlined로 내림. '확인할 내용'이 1개 이상이면 ≤1199에서 본문 맨 위로 올림.
- 비용: 중간
- 같은 문제가 있는 다른 곳: 홈의 연구 도우미 카드 링크 2개와 사이드바 연구 도우미가 겹침.

### [E-7] 학생 소유자가 검토 상세를 열면 셸과 검토 머리가 겹침
- 위치: `/reviews/:id`(학생 소유자) · 모든 너비 · 공통 / RmsApp.tsx:81-91; components/WorkspaceShell.tsx:436-507; pages/reviews/ReviewDetailPage.tsx:483-583
- 심각도: 보통
- 반박 검증: 확인(화면). 390px 학생 검토 상세에 셸 머리 아래 두 번째 로고·뒤로 화살표가 또 나옴(shots/review-detail-390-light.png).
- 무엇: `ReviewRoute`는 소유자이면 `<Shell researchOverride>`로 감쌈. 그래서 사이드바(로고·계정 메뉴)와 topbar 경로 표시(연구명 › 검토 요청) 아래에 `review-workspace-header`(로고 + 화살표·h1·계정 아바타 메뉴)가 다시 나옴. `<main id="main-content">` 안에 `<main className="review-workspace">`가 겹쳐 들어감. reviews.css에 셸 안에서 머리를 숨기는 규칙이 없음(검색 결과 0건). [코드 확인] 실제로 겹쳐 보이는지는 [추측]
- 왜: 로고·계정 메뉴가 두 번 보이고, 같은 이동(검토 요청 목록)이 경로 표시와 로고 화살표로 두 번 있음. 랜드마크가 겹쳐 보조기기 탐색이 어려움.
- 제안: 셸 안에서는 `review-workspace-header`를 PageHeader 모양으로 바꿈(back "검토 요청 목록", 제목, 공유 상태 ContentBadge, actions: 링크 복사 solid + 공유 설정 outlined + 새로고침 IconButton). 로고·계정 메뉴는 교수용 독립 화면에서만 그림. 안쪽 `<main>`은 `<div>`로.
- 비용: 작음
- 같은 문제가 있는 다른 곳: `PollRoute`(RmsApp.tsx:93-105)도 같은 구조. 다만 PollPage는 자체 머리가 PageHeader라 겹침이 덜함.

### [E-8] '할 일'이 사이드바에 없어 화면마다 위계가 다르게 보임
- 위치: 사이드바·홈·⌘K · 모든 너비 · 공통 / lib/command-items.ts:7-15; components/WorkspaceShell.tsx:307-332; HomePage.tsx:385-470; RmsApp.tsx:127-134
- 심각도: 보통
- 반박 검증: 확인(화면). 할 일 화면에서 사이드바 선택이 ‘피드백·수정’.
- 무엇: 사이드바는 '피드백·수정' 하나로 피드백·할 일·결과를 묶고, /tasks·/results에서도 '피드백·수정'을 선택된 상태로 표시함(324). 반면 홈은 '남은 할 일'을 주요 영역으로 두고, G T와 ⌘K '할 일'은 따로 있는 화면처럼 다룸. 피드백 상세에는 WorkTabs가 없어 할 일·결과로 옆 이동할 수 없음. RmsApp.tsx:127-134에는 '할 일'이 들어 있는 다른 `navigation` 배열이 남아 있는데 쓰이지 않음. [코드 확인]
- 왜: 할 일이 1단계 메뉴인지 2단계인지가 진입점마다 다름. IA §2는 할 일을 독립 메뉴(S09)로 둠.
- 제안: 선택지 A: 사이드바에 '할 일'을 독립 항목으로 두고(IA와 맞춤) WorkTabs는 피드백·수정 결과 2개로 줄임. 선택지 B: 지금 구조를 유지하고 '피드백·수정' 머리를 고정 제목 + `Tab` 3개로 둠(E-1). 쓰지 않는 `navigation` 배열은 지움.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 브라우저 탭 제목은 '피드백'/'할 일'로 따로 나옴(RmsApp.tsx:302-316).

### [E-9] 목록 찾기 칸이 화면마다 다름(검색 아이콘 없음, 찾기 칸 없음)
- 위치: 검토 요청 목록, 글쓰기 목록, 계획·일정 · 모든 너비 · 공통 / ReviewsPage.tsx:232-245; WritingPage.tsx:142-247; shared.tsx:340-366
- 심각도: 낮음
- 무엇: 다른 목록은 `SearchInput`(TextField medium + 검색 아이콘, ≥768 auto 너비)을 쓰는데 검토 요청은 `Input`(아이콘 없음, width 100%)을 씀. 글쓰기 목록에는 찾기·종류 필터가 없음. [코드 확인]
- 왜: 같은 목록 머리가 서로 다르게 보임(CHANGELOG의 '목록 위 검색 칸 40px 통일'이 덜 끝남).
- 제안: 검토 요청은 `SearchInput placeholder="제목이나 교수 이메일로 찾기"`로 바꿈. 글쓰기 목록 toolbar에 `SegmentedControl`(전체·계획서·원고) + `SearchInput`을 추가함.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 없음.

### [E-10] 미팅 상세: 공개 범위 칸이 머리와 탭 사이에 있음
- 위치: 미팅 상세 · 모든 너비 · 공통 / MeetingsPage.tsx:764-789; components/experience.tsx:258-304
- 심각도: 낮음
- 무엇: `VisibilityField`(제목 + 선택 상자 또는 '나만 보기' + 안내 글) 묶음이 PageHeader와 준비·기록·결정 탭 사이에 있음. 화면의 기본 이동인 탭이 그만큼 아래로 밀림. [코드 확인]
- 왜: 자주 바꾸지 않는 설정이 매번 보는 이동보다 위계가 높게 놓임.
- 제안: 제목 줄에 `ContentBadge`(neutral, 자물쇠 아이콘) "나만 보기"/"공동연구자와 공유"만 두고, 바꾸기는 '미팅 정보 편집' 대화상자 안으로 옮김.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 글쓰기 상세 목차 옆(WritingPage.tsx:568)은 옆 칸이라 괜찮음.

### [E-11] 필터 보기 전환 칸이 5개라 ≤767에서 넘칠 수 있음
- 위치: 미팅·피드백 목록 · ≤767 · 공통 / MeetingsPage.tsx:51-57, 188-194; FeedbackPage.tsx:42-48, 115-121; pages/student/student.css:1480-1484
- 심각도: 낮음
- 무엇: 칸 5개에 개수 숫자가 붙음. 좁은 화면 도구 줄은 세로로 쌓기만 함(student.css:1481-1484). SegmentedControl이 가로 스크롤하는지는 코드에서 확인하지 못함. [추측]
- 왜: 360px 안팎에서 글자가 잘리거나 칸이 찌그러질 수 있음(docs/design/ui-quality.md 레이아웃 기준).
- 제안: ≤767에서는 `Select`(medium)로 바꾸거나, '전체'를 빼고 Montage `Chip` 줄(가로 스크롤)로 바꿈. 사용자가 실제 너비에서 확인해야 함.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 할 일 목록 Segments 4개 + 선택 상자 2개(TasksPage.tsx:362-406).

---

## E-12. 표준 머리 제안(기존 부품만 사용)

공통 순서: `back`(선택) → 제목 줄[제목 · 상태 ContentBadge | actions] → 설명 1줄 → `tabs`(선택) → `toolbar`(선택). PageHeader에 슬롯 3개(back·tabs·toolbar)만 추가하면 됨. actions는 solid primary를 많아야 1개, outlined assistive 1개, 나머지는 `IconButton` "더보기" + Montage Menu.

### 목록(미팅·피드백·할 일·수정 결과·자료·검토 요청·글쓰기)
- 구성: 제목(명사) · 설명 1문장 · actions[solid "OO 만들기/추가"] · tabs[같은 묶음 이동이 있을 때 Montage Tab: 피드백·할 일·수정 결과] · toolbar[SegmentedControl(필터, 개수) | SearchInput | Select 필터 | 결과 개수].
- ≥1200: 제목 줄 한 줄(actions 오른쪽 끝). toolbar 한 줄(SearchInput은 auto 너비, 약 280px).
- 768–1199: 제목 줄 유지, 설명이 2줄까지 감길 수 있음. toolbar 첫 줄은 SegmentedControl + SearchInput, Select 필터는 둘째 줄로 감김.
- ≤767: 제목(heading1) 아래 설명 1줄. actions 버튼은 `fullWidth="mobile"`로 설명 아래 한 줄 전체. Tab은 가로 스크롤. toolbar 순서는 SearchInput(전체 너비) → 필터(5개 이상이면 Select). BackLink 없음.

### 상세(미팅·피드백·할 일·수정 결과·자료·검토 상세(학생))
- 구성: back[BackLink "← {출발 화면}", H-7의 from 반영] · 제목 + 상태 ContentBadge(제목 줄 안) · 설명(날짜·출처 등 메타 1줄) · actions[solid = 흐름의 다음 단계(결과: 검토 요청 만들기 / 피드백: 수정 방법 정하기 / 할 일: 완료로 표시 / 자료: 새 버전 추가), outlined = 편집, 그 밖은 IconButton Menu] · tabs[미팅만: 준비·기록·결정·질문].
- ≥1200: topbar 경로 표시를 3단계(연구 › 메뉴 › 기록 이름)로 하고 BackLink를 숨김. 본문 2열(내용 | 관련 기록 aside).
- 768–1199: 경로 표시 3단계 유지. actions 2개를 제목 줄 오른쪽에 두고 줄이 넘치면 설명 아래로 감김. aside는 본문 아래로.
- ≤767: BackLink를 보이고 경로 표시는 연구명만. actions는 solid를 `fullWidth="mobile"`로, 편집은 IconButton(제목 줄 오른쪽). 상태 배지는 제목 아래 메타 줄로.

### 홈(연구 홈)
- 구성: PageHeader title=연구명, description="현재 단계 · 다음 미팅 D-n", actions[상황별 solid 1개] · 본문 순서: 확인할 내용(1개 이상일 때) → 다음 미팅(주간 띠 포함) → 남은 할 일 → 최근 문서 → 연구 단계.
- ≥1200: 2열(왼쪽 다음 미팅·할 일·문서, 오른쪽 확인할 내용·도우미·최근 활동). 확인할 내용이 0이면 오른쪽 열 맨 아래로.
- 768–1199: 1열. 확인할 내용이 있으면 맨 위 한 줄 묶음으로.
- ≤767: 1열. 바로 시작은 `TextButton` 목록 3줄(이미 한 묶음 목록, CHANGELOG). actions solid는 `fullWidth="mobile"`.

### 설정(계정·연구)
- 구성: PageHeader title(계정 설정/연구 설정), description(연구명) · 섹션 이동 · 섹션마다 저장(solid 1, 섹션 아래).
- ≥992: 왼쪽 옆 메뉴(Link, aria-current=page) + 오른쪽 본문.
- 768–991: 옆 메뉴 대신 Montage `Tab`(가로) 하나만 둠.
- ≤767: `Tab` 가로 스크롤. 저장 버튼은 섹션 아래 `fullWidth="mobile"`. 바꾼 내용이 있으면 탭 이동을 막는 지금 동작(SettingsPage.tsx:455-459)은 유지.

### 교수 독립 화면(검토·조율) 참고
- 로고(링크 아님 또는 "받은 요청"으로) · 제목 · "학생이 보낸 수정 결과" 메타 · 오른쪽에 "응답 n/m" ContentBadge + 새로고침 IconButton + 계정 Menu. 결과를 저장하면 "다음 항목" solid(H-3). 학생 대시보드 모양의 요약은 넣지 않음.
