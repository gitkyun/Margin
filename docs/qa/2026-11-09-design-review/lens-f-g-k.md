# 마진(Margin) 정적 검수 — F 한국어 줄바꿈 · G 톤앤매너 · K 유지보수
> 이 부록은 코드만 읽어 작성했어요(작성 시점에는 렌더링 없음). 이후 데모 모드 실제 화면(헤드리스 Chrome)과 계산된 스타일로 막힘·높음과 [추측] 항목을 다시 확인했고, 판정은 각 항목의 `- 반박 검증:` 줄과 [보고서 본문](../2026-11-09-design-review.md) §5에 적었어요.


- 대상: `apps/home-preview` (main @ e6589b9, 작업 트리 깨끗함). 저장소 파일은 고치지 않음.
- 방법: 코드만 읽음(grep·정적 스크립트). Node가 없어 typecheck·test·build·브라우저 렌더링은 **실행하지 않음**. 화면을 직접 보지 않았으므로 “보이는 그대로”는 CSS·JSX에서 예상한 모습이며, 시각 결과는 모두 [추측]으로 표시함.
- 태그: [코드 확인] = 파일·줄에서 직접 확인 / [추측] = 렌더링·라이브러리 기본값·Montage 패키지 값(이 환경에 `node_modules` 없음)에 기댄 판단.
- 기준 문서: AGENTS.md, docs/design/ui-quality.md, ux-writing.md, README.md §3, CHANGELOG.md Unreleased.

---

## F. 한국어 줄바꿈·잘림

전역 규칙은 문서대로 있음: `src/styles.css:60-61` `word-break: keep-all; overflow-wrap: break-word`, `:68` 제목 `text-wrap: balance`, `:76` 본문 `pretty` [코드 확인]. 그 위에 `white-space: nowrap` 52곳, `text-overflow: ellipsis` 26곳, `line-clamp` 7곳, 고정 높이+overflow hidden 10곳이 있음. 이 중 장식(진행 막대·sr-only·캔버스)과 이미 상세 화면이 있는 보조 설명(ui-quality §6 ‘의도적으로 남긴 것’)은 제외하고 아래만 올림.

### [F-1] 교수 검토 화면에서 ‘보낸 당시 파일’ 이름이 한 줄로 잘림
- 위치: 교수 검토 상세 · 360~1024px에서 특히 · 라이트/다크 공통 / `src/pages/reviews/reviews.css:650-651`(`.review-file-heading strong` nowrap+ellipsis), `src/pages/reviews/ReviewDetailPage.tsx:737-740`, `src/styles.css:1112-1113`(`.pdf-file-name`), `src/components/PdfViewer.tsx:136-139`, `reviews.css:478-479`(`.review-item-version`, `ReviewDetailPage.tsx:610-613`)
- 심각도: 높음
- 반박 검증: 확인(화면 자동 검사). 1024px에서 ‘1차 검토 · 선행연구_비교표_v2.pdf’가 말줄임으로 잘림, 360px에서는 차수 선택 ‘1차 검토 · 최신’도 잘림.
- 무엇: 파일명 `<strong>{version.fileName}</strong>` 옆에 ‘보낸 당시 파일’ 라벨이 같은 줄에 있고, 파일명은 `white-space: nowrap; text-overflow: ellipsis`. PDF 도구 막대의 파일명, 항목 목록의 ‘N차 검토 · 파일명’도 같은 방식. `title`·툴팁 없음. [코드 확인] `논문_3장_수정본_v2.pdf`/`…_v3.pdf`처럼 **끝부분만 다른 이름**은 잘린 상태에서 구분되지 않음 [추측].
- 왜: ui-quality §2 “고정 높이·nowrap이 중요한 내용을 숨기지 않는가”. 교수는 어떤 버전을 보고 있는지 확인해야 함(AGENTS ‘보낸 파일 보존’, ux-writing §7 ‘당시 파일’). 원인: **줄바꿈 규칙**(nowrap) + **컨테이너 너비**.
- 제안: 같은 파일의 `.review-file-chip strong`(reviews.css:289)처럼 `overflow-wrap: anywhere`로 줄바꿈 허용하고 라벨은 다음 줄로. 한 줄을 유지해야 하는 PDF 도구 막대만 확장자를 남기는 가운데 말줄임 + Montage `Tooltip`으로 전체 이름. 글자 크기는 Montage `label1` 그대로.
- 비용: 작음
- 같은 문제가 있는 다른 곳: `.writing-outline > button`(writing.css:190-191, 목차 제목), `.goal-row strong`(screens.css:180-181, 주요 목표 제목 — 누르면 상세 대화상자가 있어 덜 급함)

### [F-2] 선택한 원문 칩: CSS는 말줄임을 기대하는데 JSX 구조가 달라 긴 파일명이 칩 밖으로 나갈 수 있음
- 위치: 연구 도우미 입력창 · 360~767px · 공통 / `src/pages/assistant.css:265-283`, `src/pages/ResearchAssistant.tsx:834-845`
- 심각도: 보통
- 무엇: CSS는 `.context-chip > span { max-width:220px; nowrap; ellipsis }`인데 JSX의 제목은 `<span className="context-chip">` 안의 **맨 글자 노드**(`{c.title}{c.page && …}`)라 이 규칙이 적용될 요소가 없음 [코드 확인]. 칩은 `inline-flex`이고 이름 없는 flex 항목의 최소 너비는 가장 긴 단어 폭이라, 공백 없는 긴 파일명은 칩·입력창을 넘칠 수 있음 [추측].
- 왜: AGENTS “AI는 선택한 원문에 한해…”: 사용자가 어떤 원문을 골랐는지 확인하는 자리. 원인: **배치**(구조 불일치).
- 제안: 제목을 `<span className="context-chip-title">`로 감싸고 `min-width:0; overflow-wrap:anywhere`(두 줄 허용)로 둠. 선택 해제 버튼은 Montage `IconButton`(size small)로. 이름 전체는 이미 `aria-label`에 있음.
- 비용: 작음
- 같은 문제가 있는 다른 곳: CSS만 남고 쓰이지 않는 말줄임 규칙: `.home-task strong`, `.home-materials strong`, `.previous-record p`, `.kpi-cell strong small`, `.review-account-label`(K-3 참고)

### [F-3] 한국어 문단에 `overflow-wrap: anywhere`를 넓게 써서 keep-all이 무력해질 수 있음
- 위치: 연구 홈·피드백·검토·대화 · 좁은 flex/grid 칸 · 공통 / 예: `research-home.css:71`(`.rh-intro-copy > p`), `:384`(`.rh-meeting-goal`), `student.css:751`(`.feedback-body`), `reviews.css:862`(`.review-comment-body`), `:721`, `:819`, `expansion.css:1146`(`.chat-message`), `:1474`(`.transcript-text`), `assistant.css:164`(`.ai-message > div`) 등 약 60곳
- 심각도: 보통
- 무엇: `anywhere`는 `break-word`와 달리 **최소 콘텐츠 폭을 글자 하나로** 줄임 [코드 확인: 속성값]. 그래서 `min-width:auto`인 flex 항목이나 `auto` grid 열 안에서는 칸이 좁아질 때 ‘연/구’처럼 단어 중간에서 끊길 수 있음 [추측]. `student.css:104-110` 주석이 바로 이 성질을 이용한 사례(제목이 다른 열을 덮지 않게).
- 왜: ui-quality §2 “좁은 flex/grid 안의 **긴 토큰**에는 해당 요소에 `anywhere`”. 문단 전체에 쓰라는 규칙이 아님. 원인: **줄바꿈 규칙**.
- 제안: 문단은 전역 `break-word`를 그대로 물려받고 부모에 `min-width:0`/`minmax(0,1fr)`. `anywhere`는 파일명·링크·이메일 요소(`.external-reference a`, `.mu-file-info > strong` 등)에만.
- 비용: 중간(곳마다 부모 배치 확인 필요)
- 같은 문제가 있는 다른 곳: `writing.css:231`(`.rms-document-editor` 본문 전체), `version-compare.css:71`

### [F-4] 소개·로그인·가입 화면의 본문 문단에 강제 개행 `<br>`
- 위치: 소개/로그인/가입 · 768~1024px에서 특히 · 공통 / `src/pages/PublicPages.tsx:152, 362, 422, 441, 480, 889, 896, 908, 991, 996`, `src/components/marketing/WorkflowStack.tsx:125`(= PublicPages 570), `src/pages/AuthPages.tsx:86`
- 심각도: 보통
- 무엇: 제목이 아닌 `<p>`·`<span>` 안에 `<br />`가 13곳 [코드 확인]. 좁은 화면에서 숨기는 규칙은 `.lp-feature-copy br`(public-site.css:1665)와 `.lp-faq h2 br`(:1961)뿐이라 히어로 설명(362), 섹션 설명(422), 가입 안내(908·996)는 모든 너비에서 강제로 끊김. 칸이 그 줄보다 좁으면 ‘강제 줄 + 자동 줄’이 섞여 마지막 줄에 한두 단어가 남음 [추측]. 441은 `<br />할 일에서도…`처럼 줄 앞에 붙어 있음. `styles.css:1910`, `experience.css:1913`의 `.login-intro h1 br` 숨김 규칙은 쓰이지 않는 클래스.
- 왜: ui-quality §2 “강제 개행(`<br>`)은 소개 화면의 큰 제목에만, 좁은 화면에서 어색하면 너비별로 풀어 줍니다.” 원인: **줄바꿈 규칙** + **문구 길이**.
- 제안: 문단의 `<br>`는 지우고 `max-width: 32em` 같은 글줄 폭 + `text-wrap: pretty`(이미 전역)로 맞춤. 줄 위치가 꼭 필요한 큰 제목(355·417·597·654·699)만 남기고, 768px 아래에서 `br { display:none }`.
- 비용: 작음
- 같은 문제가 있는 다른 곳: `RecordingPanel.tsx:506`(실시간 전사 조각 사이 `<br />`는 의미 있는 줄바꿈이라 유지 가능), 로그인 모바일에서 `.auth-story > p { display:none }`(experience.css:1825)로 설명이 통째로 사라짐

### [F-5] 날짜·숫자 메타 줄이 숫자와 단위·라벨 사이에서 끊길 수 있음
- 위치: 목록 보조 줄 전반 · 360~390px · 공통 / `MeetingsPage.tsx:231-233`(`… · 할 일{" "}{n}개`), `FeedbackPage.tsx:147-151`, `PlanningPage.tsx:234, 464-465`, `AuthPages.tsx:399-410`, `WritingPage.tsx:237-243`; 날짜 `toLocaleString("ko-KR")` `SavedTranscript.tsx:236`, `WorkspaceShell.tsx:576, 609`, `ResearchAssistant.tsx:676`, `WritingPage.tsx:793`, `toLocaleDateString` `WritingPage.tsx:237`, `HomePage.tsx:496`, `AuthPages.tsx:284`
- 심각도: 보통
- 무엇: keep-all은 **띄어쓰기에서** 줄을 바꿈. ‘할 일 3개’는 ‘할 일 / 3개’, ‘2026. 11. 9. 오후 2:00:00’은 ‘2026. 11. / 9. 오후…’처럼 갈라질 수 있음 [추측]. `toLocaleString`은 초까지 나와 메타 줄을 더 길게 함 [코드 확인: 옵션 없음].
- 왜: ux-writing §5 표기 “숫자와 단위는 붙입니다: 2개, 3건, 11월 11일 (수)”. 원인: **줄바꿈 규칙** + **문구 길이**.
- 제안: `MetaList` 공용 부품: 항목마다 `white-space: nowrap`인 `<span>`, 가운뎃점 구분자에서만 줄바꿈. 날짜는 `formatDate`(domain.ts:461)와 짝인 `formatDateTime` 하나로 모으고 초 제거. 글자는 Montage `caption1`.
- 비용: 중간
- 같은 문제가 있는 다른 곳: G-5(날짜 표기 세 종류)

### [F-6] 휴대폰 할 일 목록: 제목을 두 줄로 자르면서 ‘우선순위 높음’ 점도 함께 잘림
- 위치: 할 일 · ≤767px · 공통 / `src/pages/student/student.css:1592-1602`, `src/pages/student/TasksPage.tsx:444-453`
- 심각도: 보통
- 무엇: 휴대폰에서 행 격자가 `17px minmax(0,1fr) 75px 52px`, 제목 `<strong>`은 `-webkit-line-clamp: 2; overflow:hidden`이고 글자는 `label2`로 한 단계 줄어듦. 우선순위 점(`.priority-dot`, `role="img"`)이 그 `<strong>` **안, 제목 뒤**에 있어 제목이 두 줄을 넘으면 점이 잘려 안 보임 [코드 확인: 구조 / 추측: 렌더링]. 보조 설명은 `caption2`로 더 줄어듦(1603-1606).
- 왜: 상태를 색 점 하나로만 보여 주는데 그마저 숨음(ui-quality §3 ‘상태 구분’). 제목은 ‘중요한 내용’. 원인: **컨테이너 너비** + **배치**.
- 제안: 점을 제목 앞 또는 별도 격자 칸으로 빼고 Montage `ContentBadge`(size xsmall, ‘높음’ 글자)로. 제목은 자르지 않고(설명만 2줄) 상태·기한 열을 제목 아래 줄로 내림.
- 비용: 작음
- 같은 문제가 있는 다른 곳: `.meeting-row-copy > span`(student.css:438-440 데스크톱 1줄, 1510 휴대폰 2줄 — 보조 설명이라 허용 범위)

### [F-7] 스크롤바를 숨긴 가로 스크롤 줄: 화면 끝에서 잘린 항목이 있다는 표시가 없음
- 위치: 보기 전환·설정 탭·글쓰기 도구 막대 · 360px · 공통 / `src/design/montage.css:17-23`(`.rms-segments` `overflow-x:auto; scrollbar-width:none`), `src/reference.css:591, 598-606`(설정 탭), `src/pages/writing.css:544-548`(`.editor-dock`), `src/pages/assistant.css:546, 603`
- 심각도: 보통
- 반박 검증: 확인(화면). 360px 미팅 목록 보기 전환에서 ‘날짜 미정’이 오른쪽 끝에서 잘리고 더 있다는 표시가 없음(shots/meetings-360-light.png).
- 무엇: 긴 보기 전환 라벨 예: `ResultsPage.tsx:262-264` ‘전체 / 검토 요청 전 / 검토 요청에 포함’, `TasksPage.tsx:367-370` 네 개, `PlanningPage.tsx:139-145` ‘연구 로드맵 / 캘린더 / 시간 조율 N’. 항목은 `flex: 0 0 auto`라 줄지 않고, 넘치면 스크롤바 없이 오른쪽이 잘림 [코드 확인: CSS / 추측: 360px에서 실제로 넘치는지].
- 왜: ui-quality §2 “버튼·탭·배지 글자가 잘리지 않는가”. 원인: **문구 길이** + **컨테이너 너비**.
- 제안: 먼저 문구를 줄임(‘검토 요청에 포함’→‘요청에 포함’, ‘연구 로드맵’→‘로드맵’; ux-writing §6 탭 2~6자). 그래도 넘치면 Montage `SegmentedControl`의 `fill` 대신 Montage `Select`로 바꾸거나, 가장자리 흐림 마스크로 넘침을 표시.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 글쓰기 서식 버튼(휴대폰에서 일부가 화면 밖), 대화 목록 가로 줄(assistant.css:541-547)

### [F-8] 11px(caption2) 글자 109곳, 휴대폰에서 글자 단계를 낮춰 맞추는 규칙이 많음
- 위치: 전 화면 · 휴대폰 위주 · 공통 / `--typography-caption2-fontSize` 사용 109곳(styles.css 25, experience.css 20, reviews.css 14, student.css 13, research-home.css 9 …). 예: `student.css:1604`, `experience.css:1831-1833`(`.role-choice small`), `styles.css:1699-1712`(`.page-title` title2→title3, 설명 label1→label2·`max-width:320px`)
- 심각도: 보통
- 무엇: caption2는 Montage 눈금에서 11px [추측: 패키지 미설치로 값 미확인]. 휴대폰 미디어쿼리에서 제목·설명·보조글을 한 단계씩 줄이는 규칙이 여러 파일에 있음 [코드 확인].
- 왜: ui-quality §4 “9~11px 글자는 장식용 미리보기 외에는 쓰지 않습니다”, §2 “글꼴을 줄여서 맞추지 않습니다”(줄이기는 마지막 수단). 원인: **컨테이너 너비**를 글자 크기로 해결.
- 제안: 정보 글자의 하한을 Montage `caption1`(12px)로. 휴대폰은 글자 대신 배치(열을 줄 아래로)로 해결. 제목의 반응형 단계는 하나의 표(예: title2→heading1)로 한 파일에만.
- 비용: 중간
- 같은 문제가 있는 다른 곳: K-2의 `.page-title` 휴대폰 규칙이 두 파일에서 서로 다른 단계로 지정됨

### [F-9] nowrap인 상태 문구가 줄바꿈 없는 flex 줄 안에 있음(글쓰기 저장 상태)
- 위치: 글쓰기 문서 · 360px · 공통 / `src/pages/writing.css:135-147`(`.writing-meta` flex, wrap 없음), `:612-615`(`.writing-save-status` nowrap), `src/pages/WritingPage.tsx:495-502`
- 심각도: 낮음
- 무엇: ‘저장하지 않은 변경 · 1,234자 · 저장 12회’가 줄바꿈 없는 flex 한 줄. 상태는 nowrap, 나머지 두 칸은 그렇지 않아 좁으면 ‘저장 / 12회’처럼 칸 안에서 갈라지거나 넘칠 수 있음 [추측].
- 왜: ui-quality §2 “문구를 바꾼 뒤 주변 요소가 밀리거나 겹치지 않는가”. 원인: **배치**.
- 제안: `.writing-meta { flex-wrap: wrap; row-gap: 4px }`, 각 칸 nowrap. 문구는 G-8 참고.
- 비용: 작음
- 같은 문제가 있는 다른 곳: `.student-filter-row > label`(student.css:77-80 nowrap+flex-shrink 0, 부모는 wrap이라 안전), `.editor-dock > a`(writing.css:375-386 min-width 104px)

### [F-10] 목록 제목 한 줄 말줄임(상세 화면 있음, 보조 정보)
- 위치: 계획·글쓰기 목록·홈 주간 띠·대화 목록 · 공통 / `screens.css:180-181`(`.goal-row strong`), `writing.css:76-77`(`.document-tile` 아래 제목), `week-strip.css:140-141`(`.rh-week-item strong`), `assistant.css:52-53`(대화 제목), `student.css:354, 438-440, 1089-1091`, `screens.css:531-532`(`.member-row small` — 같은 선택자에 `expansion.css:1565` anywhere가 따로 있어 규칙이 충돌)
- 심각도: 낮음
- 무엇: 누르면 상세로 가는 목록 줄의 제목/보조 글이 1줄 말줄임 [코드 확인]. 글쓰기 카드는 위쪽 미리보기에 같은 제목(`h3`)이 다시 나와 정보 손실은 적음.
- 왜: ui-quality §2 ‘목록 보조 설명은 줄일 수 있지만 원문은 상세에서 전부’ — 대부분 허용 범위. 단, 주요 목표 제목·목차는 ‘제목’이라 2줄 허용 권장. 원인: **줄바꿈 규칙**.
- 제안: 제목은 2줄 clamp + Montage `Tooltip`, 보조 글만 1줄.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 없음

---

## G. 톤앤매너

### G-1 문구

전반적으로 해요체가 잘 지켜짐 [코드 확인]: JSX·toast·aria-label에서 합니다/습니다/하십시오 문장은 거의 없고, 서버 문구는 `src/lib/server-messages.ts`에서 해요체로 바꿈. 피할 말 ‘승인·반려·통과·채택·스냅샷·보존·방안·리뷰·태스크’는 TSX 0건. 남은 것은 같은 동작의 이름 차이와 표기 일관성.

### [G-1] ‘삭제’ 버튼이 실제로는 휴지통으로 옮김(완전 삭제와 이름이 겹침)
- 위치: 내 연구 목록·연구 설정 · 공통 / `src/pages/AuthPages.tsx:478-486`(버튼 ‘삭제’) → `:525` ‘연구를 휴지통으로 옮길까요?’ → `:576` ‘휴지통으로 옮기기’; `src/pages/SettingsPage.tsx:683`(소제목 ‘연구 삭제’) → `:695` ‘휴지통으로 옮기기’; 완전 삭제는 `PermanentResearchDelete.tsx:44, 138` ‘완전히 삭제’
- 심각도: 보통
- 무엇: 같은 화면 흐름에서 ‘삭제’ → ‘휴지통으로 옮기기’ → ‘완전히 삭제’가 섞임 [코드 확인].
- 왜: ux-writing §6 버튼 “누르면 일어나는 일”, 확인 창 “주 버튼은 제목의 동사와 맞춤”. AGENTS ‘자동 영구 삭제 금지’와 맞물려, ‘삭제’가 되돌릴 수 없다고 오해하게 하거나 반대로 ‘완전히 삭제’를 가볍게 보이게 함.
- 제안: 트리거를 ‘휴지통으로 옮기기’(Montage `TextButton` assistive, 또는 `IconButton` trash + 이름 ‘휴지통으로 옮기기’), 설정 소제목은 ‘휴지통으로 옮기기’. ‘삭제’는 완전 삭제에만.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 글쓰기 비교 범례 ‘삭제/추가’(WritingPage.tsx:70)는 글자 차이 표시라 별개(문제 아님)

### [G-2] ‘참여자’와 ‘공동연구자’가 같은 대상을 가리킴
- 위치: 연구 설정 · 공통 / `SettingsPage.tsx:445`(탭 ‘참여자’), `:531`(‘연구 참여자’), `:533-535`; 같은 화면 `:724`와 `components/experience.tsx:280`은 ‘공동연구자’; 교수 검토 댓글 작성자 대체 이름 ‘검토 참여자’ `ReviewDetailPage.tsx:94, 125, 972`
- 심각도: 낮음
- 무엇: [코드 확인]
- 왜: ux-writing §5 “공동연구자 / 참여자(설정 화면의 **권한 설명**에서만)”. 탭·제목은 라벨이라 대상 아님. ‘검토 참여자’는 학생인지 교수인지 알 수 없음.
- 제안: 탭·제목 ‘공동연구자’, 설명 문장에서만 ‘참여자’. 검토 댓글 대체 이름은 역할(‘학생’/‘교수’)로.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 녹음 동의 문구의 ‘참여자’(RecordingPanel.tsx:660, 686)는 미팅 참석자라 맞는 쓰임

### [G-3] 교수 검토 화면에 내부 용어 ‘차수’가 설명 없이 반복
- 위치: 교수 검토 상세 · 공통 / `ReviewDetailPage.tsx:643`(‘검토 차수’), `:682`(‘이전 차수예요’), `:684`(‘최신 차수 열기’), `:885`, `:908`, `:1150`
- 심각도: 낮음
- 무엇: [코드 확인]
- 왜: ux-writing §3⑥ 내부 기획 용어 ‘차수(설명 없이)’, §5 ‘다시 확인 요청, 2차 검토’.
- 제안: ‘검토 차수’·‘이전 차수’ 대신 ‘N차 검토’로 통일: ‘이전 검토(1차)예요’, ‘최신 검토 열기(2차)’, ‘이 항목은 2차 검토가 있어 1차에는 응답할 수 없어요’.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 없음

### [G-4] 같은 ‘보관’ 동작의 버튼 문법이 섞임
- 위치: 연구 설정·자료·할 일·폴더·계획 / `SettingsPage.tsx:679`(‘보관하기/복원하기’), `:770`(확인 ‘보관’), `MaterialsPage.tsx:362`(‘자료 보관/자료 복원’), `TasksPage.tsx:345`(‘할 일 보관’), `:840`(‘보관’), `MaterialFolders.tsx:243`(‘폴더 보관’), `PlanningPage.tsx:568`(‘단계 보관’)
- 심각도: 낮음
- 무엇: ‘~하기’와 ‘대상+명사’가 화면마다 다름 [코드 확인].
- 왜: ux-writing §6 버튼 “짧은 명사형이나 ‘~하기’” — 둘 다 허용이지만 같은 동작은 같은 이름(§6 접근성 이름 “같은 동작은 같은 이름”).
- 제안: 화면 안 버튼은 ‘대상 보관/대상 복원’, 확인 창 주 버튼은 ‘보관’으로 통일.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 없음

### [G-5] 날짜 표기가 세 가지
- 위치: 전 화면 / 입력 `components/ui/date-field.tsx:66`(`YYYY.MM.DD`), 목록 `lib/domain.ts:461-470` formatDate(‘11월 9일 (월)’), 그 밖 `toLocaleDateString/LocaleString("ko-KR")`(‘2026. 11. 9.’, ‘2026. 11. 9. 오후 2:00:00’) 9곳(F-5 목록)
- 심각도: 보통
- 무엇: 같은 화면(글쓰기 문서 카드와 버전 선택)에서도 형식이 다름 [코드 확인].
- 왜: ux-writing §5 표기 ‘11월 11일 (수)’. 사용자가 날짜를 비교하기 어려움.
- 제안: 표시는 formatDate 계열 하나(연도가 다를 때만 연도), 입력만 Montage `DatePicker` 형식. `formatDateTime`(‘11월 9일 (월) 오후 2:00’) 추가.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 알림 판(WorkspaceShell.tsx:576, 609)

### [G-6] 숫자 뒤 단위 빠짐, 알림 마침표 혼용, 번역투 상태 문구
- 위치: `HomePage.tsx:356, 360`(‘자료 3’, ‘질문 2’), 알림 마침표 있음 15곳·없음 25곳(예: `SettingsPage.tsx:294` ‘설정을 저장했어요.’ vs `FeedbackPage.tsx:215` ‘피드백을 저장했어요’), `WritingPage.tsx:498`(‘저장하지 않은 변경’), `:501`(‘저장 {n}회’)
- 심각도: 낮음
- 무엇: [코드 확인]
- 왜: ux-writing §5 ‘숫자와 단위는 붙입니다: 2개’. ‘변경’은 명사 번역투, ‘저장 N회’는 내부 revision 값 노출.
- 제안: ‘자료 3개’, ‘질문 2개’. 알림은 한 문장이면 마침표 없이, 두 문장이면 모두 마침표(규칙을 ux-writing §6 성공에 한 줄 추가). ‘저장하지 않은 내용 있음’, ‘저장 N회’는 빼거나 ‘마지막 저장 오후 2:10’.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 소개 데모 카드 `PublicPages.tsx:202` ‘비교 기준을 더 분명히 해볼까요?’(교수 발화 예시라 허용 범위지만 §3⑥ 피할 말 ‘더 분명하게’·권유형)

### G-2 움직임

#### 움직임 목록

| 어디 | 시간 | 곡선 | 동작 | prefers-reduced-motion 대응 |
|---|---|---|---|---|
| 사이드바 접기 `.sidebar`, `.main-shell` (styles.css:168, 359) | 160ms | 기본(ease) | 너비·왼쪽 여백 | 전역 규칙 styles.css:1947-1955(0.01ms !important) |
| 메뉴 호버 `.floating-workspace .nav-item` (reference.css:506) | 150ms | ease | 배경·글자색 | 전역 |
| 연구 홈 링크·버튼 (research-home.css:31) | 150ms | ease | 배경·색·테두리 | 개별 none(:1155) |
| 카드 호버 `.document-tile` (writing.css:21 / expansion.css:865), `.phase-card`(screens.css:45), `.research-card`(styles.css:1316) | 150~160ms | ease / 기본 | 테두리·그림자(+expansion은 transform) | writing.css:565 none, 나머지 전역 |
| 입력창 초점 `.ai-composer` (assistant.css:224) | 160ms | ease-out | 테두리·고리 | 전역 |
| 진행 막대 `.rh-progress > span`(research-home.css:419), 업로드(material-upload-field.css:233) | 180ms / 160ms | ease / linear | 너비 | 개별 none |
| 드롭존 `.upload-dropzone`(student.css:1338), `.mu-dropzone`(mu:27) | 150ms / 160ms | 기본 / ease | 배경·테두리 | 개별 none |
| 할 일 완료 접힘 `taskRowMotion` (components/task-row-motion.ts, HomePage.tsx:411, TasksPage.tsx:425) | 400ms 머무름(use-task-completion.ts:7) + 220ms | cubic-bezier(0.2,0,0,1) | layout 위치 + 높이·투명도 접힘 | `MotionConfig reducedMotion="user"`(main.tsx:49): transform·layout만 끔, **높이·투명도는 남음** [추측: motion 문서 동작] |
| 셸 목록 `AnimatedList` (experience.tsx:210-226) | 160ms | motion 기본 | 투명도+y 7px, layout | useReducedMotion → 0 |
| 피드백·자료·미팅 목록 `AnimatedList` (components/AnimatedList.tsx, auto-animate) | 라이브러리 기본 [추측 ≈250ms] | 라이브러리 기본 | 들고 남·자리 이동 | 라이브러리 기본이 사용자 설정 존중 [추측] |
| 홈 숫자 `RollingNumber` (NumberFlow) | 라이브러리 기본 | 라이브러리 | 자릿수 굴림 | 기본 respectMotionPreference [추측] |
| 업로드 파일 행·제출 아이콘 (MaterialUploadField.tsx:113, 200) | 180ms / 120ms | 기본 | 투명도+y / scale | reduced → initial false |
| 스피너 `spin`(styles.css:1187), `mu-spin`(mu:257) | 800ms / 700ms 무한 | linear | 회전 | 전역 1회 / 개별 none |
| 점·마스코트 `dot-pulse` 1.2s, `rms-ai-pulse` 1.4s, `margin-attending` 2.4s | 무한 | ease-in-out | 깜빡임·떠 있음 | 개별 none |
| 소개: 버튼 `.lp-button` 0.18s, 헤더 링크 0.15~0.2s, 메뉴 패널 160ms ease-out, 기능 카드 펼침 0.34s cubic-bezier(0.2,0,0,1), 진행 막대 0.45s cubic-bezier(0.22,1,0.36,1), `RevealLine` 0.75s [0.16,1,0.3,1], 미리보기 전환 0.18~0.2s, `lp-cover-pass` 1.15s 무한, 비교 선 3s 무한, 카드 스크롤 타임라인 | 0.15~3s | 5종 | — | `.lp-site *` none !important(public-site.css:2045) + JS useReducedMotion |
| 목차 이동 scrollIntoView (WritingPage.tsx:553-557) | 브라우저 | — | 부드러운 스크롤 | reduced → instant |
| Montage 부품 내부(SegmentedControl 미끄럼, Modal, Toast) | 미확인 | 미확인 | — | 미확인 [추측] |

### [G-7] 움직임 시간·곡선에 규칙(토큰)이 없음
- 위치: 위 표 / 시간 값 120·150·160·180·200·220·300·340·450·750ms, 곡선 `ease`·`ease-out`·`linear`·cubic-bezier 3종·motion 기본
- 심각도: 보통
- 무엇: 같은 ‘카드 호버’가 150ms·160ms, 같은 `.document-tile`에 두 파일이 다른 transition을 지정(writing.css:21 / expansion.css:865) [코드 확인]. 동작 토큰(`--motion-*`)이 앱에 없음. Montage 4.2.0에 동작 토큰이 있는지는 패키지가 없어 확인하지 못함 [추측].
- 왜: ui-quality §4 “Montage에서 고를 수 있는지 먼저”, 한 화면 임시 값 금지.
- 제안: 아래 3단 규칙을 `src/design/tokens.css`에 별칭으로 두고(Montage에 같은 토큰이 있으면 그것에 연결), CSS·`task-row-motion.ts`가 이것만 쓰게 함.
- 비용: 중간
- 같은 문제가 있는 다른 곳: 소개 화면 cubic-bezier 3종

**3단 움직임 규칙 제안**

| 단계 | 쓰는 곳 | 시간 | 곡선 | 동작 줄이기 |
|---|---|---|---|---|
| micro | 호버·초점·누름, 색·테두리·그림자, 체크 | 120ms (`--motion-duration-micro`) | `--motion-ease-standard: cubic-bezier(0.2, 0, 0, 1)` | 색 변화는 유지 가능, 이동 없음 |
| component | 목록 들고 남, 접힘/펼침, 툴팁·메뉴·토스트 등장, 숫자 굴림, 할 일 접힘 | 200ms 등장 / 160ms 퇴장 | 등장 standard, 퇴장 `--motion-ease-exit: cubic-bezier(0.3, 0, 1, 1)` | 높이·위치 움직임 0, 투명도만 100ms 이하 또는 즉시 |
| page | 화면 전환, 시트·대화상자, 소개 화면 장면 | 300ms (소개 히어로만 최대 600ms) | `--motion-ease-emphasized: cubic-bezier(0.2, 0, 0, 1)` 길게 | 즉시 |

원칙: 무한 반복은 ‘실제로 진행 중’일 때만(스피너·AI 실행 중), 로그인 후에는 장식 반복 금지(README §3), 지어낸 대기(인위적 stagger) 금지(experience.tsx:209 주석과 같음). `cubic-bezier(0.2,0,0,1)`은 이미 task-row-motion.ts와 public-site.css:679-680에서 쓰고 있어 기준 곡선으로 삼기 쉬움.

### [G-8] ‘동작 줄이기’에서도 할 일 접힘(높이·투명도)이 움직일 수 있고, 전역 규칙이 두 번 있음
- 위치: 홈·할 일 · 동작 줄이기 켬 / `src/main.tsx:49`, `src/components/task-row-motion.ts:7-18`, `src/styles.css:1947-1955`, `src/experience.css:1938-1947`
- 심각도: 보통
- 반박 검증: 미실행. 동작 줄이기 상태 실제 확인은 하지 않음.
- 무엇: `reducedMotion="user"`는 motion에서 transform·layout만 끄는 설정이라 `exit: { height:0, opacity:0 }`(220ms)는 남을 것 [추측: motion 문서 기준]. CSS의 `transition-duration: 0.01ms !important`는 motion이 직접 돌리는 애니메이션에는 영향이 없음 [추측]. CHANGELOG는 “동작 줄이기 설정이면 꺼짐”이라고 적음. 전역 줄이기 규칙은 styles.css와 experience.css에 같은 내용으로 두 번 [코드 확인].
- 왜: ui-quality §1·§3 ‘움직임: 동작 줄이기에서 멈추거나 줄어드는지’. 기록과 실제 동작이 어긋날 수 있음.
- 제안: `taskRowMotion`을 `useReducedMotion()`으로 감싸 줄이기일 때 `exit: { opacity: 0, transition: { duration: 0 } }`. 전역 규칙은 styles.css 하나만. 실제 브라우저(동작 줄이기 켬)에서 확인 필요.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 스피너 keyframes 두 벌(`spin` 0.8s / `mu-spin` 700ms)

### G-3 브랜드

### [G-9] 소개 화면 주 버튼과 앱 주 버튼의 모양 규칙이 다름
- 위치: 소개 헤더·히어로·마지막 CTA · 라이트/다크 / `src/pages/public-site.css:117-175`(`.lp-button`), `src/pages/PublicPages.tsx:124, 367, 373, 704, 832`
- 심각도: 낮음
- 무엇: 소개 주 버튼은 직접 만든 `.lp-button-dark`(라이트: 반전 검정 면, 다크: 브랜드 파랑, 모서리 12/10, hover 시 아이콘 이동). 앱의 주 버튼은 Montage `Button` solid primary(브랜드 파랑) [코드 확인]. CHANGELOG는 ‘헤더·히어로 버튼을 Montage 크기로 맞춤’이라 했으나 부품은 Montage가 아님. 마지막 CTA 배경 `.lp-close`(public-site.css:1319-1324)와 푸터 그라데이션(:1365, 1459, 1551, 2228)은 직접 hex 값.
- 왜: README §1 버튼은 Montage `Button`, ‘hex 값을 새로 쓰지 않습니다’(예외는 Cloud Shader·마스코트·푸터 칸 글자 그림). 소개→가입→앱으로 넘어올 때 ‘누르는 것’의 색이 바뀜.
- 제안: `<Button asChild size="large">`(Montage solid primary 또는 라이트에서 의도적으로 검정이면 solid assistive)로 바꾸고 `.lp-button`은 배치만. `.lp-close` 그라데이션은 Montage `--atomic-blue-*` 단계로.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 없음

### [G-10] 마스코트 상태 중 ‘approved’·‘completed’가 열려 있어 승인/완료로 읽힐 위험
- 위치: AI 결과 패널 / `src/components/brand/Brand.tsx:51-69`(`approved: "15_approved"`, `completed`, `happy`), `src/pages/student/AIWorkbench.tsx:173-185`
- 심각도: 낮음
- 무엇: 지금 `approved`는 쓰이지 않음. AIWorkbench는 ‘AI 제안을 모두 저장(선택)했을 때’ `completed` 캐릭터를 보여 줌 [코드 확인].
- 왜: README §3 “완료 캐릭터를 교수 승인으로 표현하지 않습니다”, ux-writing §4 ‘AI 제안을 선택함 ≠ 할 일을 끝냄’. 타입에 남아 있으면 나중에 교수 결과 옆에 쓰일 수 있음.
- 제안: `MascotState`에서 `approved`(필요하면 `happy`)를 빼서 쓸 수 없게 하고, ‘모두 선택’은 `idea`/`ready`로. 상태 문구가 늘 옆에 있는지 유지.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 공개 푸터 칸 글자 그림의 마스코트(FooterGlyphField.tsx:15)는 README가 허용한 브랜드 그림

### [G-11] 아이콘 세트 세 가지
- 위치: 전 화면 / 주 아이콘 Disarto `src/components/icons.tsx:62`, 글쓰기 서식 도구 막대만 lucide `src/pages/WritingPage.tsx:1-11`, Montage 부품 내부 아이콘(Select·DatePicker·Checkbox·Toast) [추측]; `@montage-ui/icon`은 package.json:30에 있으나 src에서 직접 쓰지 않음
- 심각도: 낮음
- 무엇: 글쓰기 도구 막대의 선 굵기·모서리가 다른 아이콘과 다르게 보일 수 있음 [추측].
- 왜: README §1 ‘Montage 부품을 그대로’, 시각 일관성.
- 제안: 서식 아이콘을 `Icon name=…`(icons.tsx 매핑)으로 옮기고 lucide 의존성 제거. 장기적으로 Montage 부품과 맞추려면 `@montage-ui/icon` 하나로.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 없음

### [G-12] 모서리 규칙(어떤 면에 몇 px)이 정해져 있지 않음
- 위치: 전 화면 / 토큰 사용: radius-10 77, -12 60, -8 48, -16 46, -4 27, -14 26, -20 19, -full 8, -24 6, -28 2
- 심각도: 낮음
- 무엇: 카드 성격의 면이 10/12/14/16으로 갈림: `.document-tile` 14 · 그 안의 `.document-tile-paper` 10, `.review-source-block` 10, `.rh-date-tile`·`.review-pick-row` 12, 검토 카드 16 [코드 확인]. 값은 모두 Montage 토큰이라 ‘눈금’은 맞지만 ‘문법’이 없음.
- 왜: README §2 “토큰에서 고릅니다” — 고르는 기준이 없으면 화면마다 달라짐.
- 제안: 4 = 안쪽 배지·숫자, 8 = 칩·줄 호버, 12 = 카드·입력·버튼 큰 것, 16 = 패널·섹션, 20~24 = 대화상자·시트, full = 원·알약. README §1에 한 줄 표로.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 없음

---

## K. 유지보수

### [K-1] 800줄 넘는 파일 17개
- 위치: `apps/home-preview/src`
- 심각도: 보통
- 무엇 [코드 확인, `wc -l`]:
  - CSS: `pages/public-site.css` 2515, `experience.css` 2138, `styles.css` 2102, `expansion.css` 1979, `pages/student/student.css` 1696, `pages/research-home.css` 1333, `pages/reviews/reviews.css` 1308
  - TSX: `pages/student/MeetingsPage.tsx` 1545, `pages/reviews/ReviewDetailPage.tsx` 1236, `pages/ResearchAssistant.tsx` 1163, `pages/PublicPages.tsx` 1117, `pages/PlanningPage.tsx` 1045, `pages/WritingPage.tsx` 991, `pages/student/FeedbackPage.tsx` 887, `pages/SettingsPage.tsx` 880, `pages/student/MaterialsPage.tsx` 860, `pages/student/TasksPage.tsx` 847
- 왜: 한 화면을 고칠 때 읽어야 할 양이 많고, 같은 파일 안의 규칙 순서에 기대는 덮어쓰기가 늘어남.
- 제안: TSX는 탭·대화상자 단위로 분리(예: MeetingsPage → 준비/기록/결정 탭, ReviewDetailPage → 교수 응답·댓글·파일 영역). CSS는 K-2 정리와 함께.
- 비용: 큼
- 같은 문제가 있는 다른 곳: —

### [K-2] 한 화면의 CSS가 여러 파일에 흩어져 있고, 같은 선택자를 여러 파일이 덮음
- 위치: `src/**/*.css`
- 심각도: 보통
- 무엇 [코드 확인, 선택자 접두어 개수]:

  | 화면 | 선택자가 있는 파일(개수) |
  |---|---|
  | 글쓰기 | writing.css 94, expansion.css 23, version-compare.css 14, student.css 7 |
  | 연구 홈 | research-home.css 248, styles.css 69, expansion.css 30, week-strip.css 30, reference.css 4, experience.css 4, screens.css 1, brand.css 1 |
  | 피드백 | student.css 20, screens.css 3 |
  | 셸(사이드바·상단) | experience.css 81, styles.css 66, reference.css 42, expansion.css 19 |
  | 연구 도우미 | assistant.css 66, experience.css 50, student.css 28, expansion.css 17, reference.css 5 |

  두 파일 이상에 같은 선택자 155개, 세 파일에 8개(`.floating-workspace .sidebar/.nav-item/.topbar…` → expansion·experience·reference). 구체 사례: `.document-tile`이 expansion.css:856-900과 writing.css:12-85에 따로(전환 속성도 다름), 휴대폰 `.page-title`이 styles.css:1708(title3)과 reference.css:658(heading1)에서 서로 다른 단계, `.member-row small`이 screens.css:531(nowrap+ellipsis)과 expansion.css:1565(anywhere)에서 반대 규칙. 모두 `@layer margin` 한 층이라 결과는 **불러오는 순서**에 달림(main.tsx:17-68; student.css·reviews.css는 지연 로드 청크).
- 왜: README §2-3 “스타일은 그 화면의 CSS 파일에 둡니다”. CHANGELOG도 ‘읽히는 순서를 지키려고 맨 위/맨 뒤에 넣음’이라 적어 순서 의존을 인정함.
- 제안: 화면별 파일 하나 원칙으로 옮기기(셸 → `components/shell.css`, 홈 → research-home.css로 모음). 옮길 때마다 K-6 스크립트로 계산된 스타일 비교. 필요하면 `@layer margin.base, margin.screen`으로 층을 나눠 순서 의존을 줄임(montage-unification-plan.md:37에 이미 같은 안).
- 비용: 큼
- 같은 문제가 있는 다른 곳: —

### [K-3] 쓰이지 않는 CSS 클래스 약 155개 후보
- 위치: `styles.css` 41/134, `experience.css` 54/127, `expansion.css` 34/150, `reference.css` 11/61, `writing.css` 5/31, 그 밖 소수
- 심각도: 보통
- 무엇: CSS의 클래스 이름이 src의 TS/TSX·index.html 어디에도 문자열로 없는 것(동적 접두어 `x-${…}`는 제외). 예: `.login-intro`(선택자 13개, 사용 0), `.home-task`, `.previous-record`, `.kpi-*`, `.dashboard-*`, `.subnavigation`, `.next-meeting-card`, `.chat-message`, `.lp-assistant-face`, `@keyframes tooltip-arrive`(writing.css:568). CHANGELOG는 ‘쓰이지 않던 기본 스위치 규칙은 삭제’라 했지만 `input[role="switch"]` 규칙이 expansion.css:1523-1538, screens.css:492-504에 남아 있고 TSX에 `role="switch"` 입력은 없음 [코드 확인]. 단순 문자열 비교라 Tiptap이 붙이는 `selectedCell` 같은 거짓 양성이 섞임.
- 왜: 죽은 규칙이 F·G 검색 결과를 흐리고(말줄임 규칙 5곳이 죽은 선택자), 같은 이름을 새로 쓰면 예전 모양이 되살아남(ui-quality §6 ‘다른 화면의 클래스 이름 재사용’ 사례).
- 제안: 후보 목록을 화면별로 확인 후 삭제. 삭제 전후 K-6의 계산된 스타일 비교로 0 차이 확인.
- 비용: 중간
- 같은 문제가 있는 다른 곳: —

### [K-4] 공용 부품 후보(같은 모양 JSX의 반복과 이름 충돌)
- 위치: 아래
- 심각도: 보통
- 무엇 [코드 확인]:
  - 이름이 같은 부품 두 벌: `ErrorNotice` — `components/common.tsx:278`(다시 불러오기 버튼 있음) / `pages/student/shared.tsx:382`(없음, 다른 클래스). `AnimatedList` — `components/experience.tsx:210`(motion, 160ms fade+y) / `components/AnimatedList.tsx`(auto-animate). 셸과 목록 화면의 목록 움직임이 다름.
  - 목록 줄 6종: `meeting-list-row`, `feedback-list-row`, `result-list-row`, `material-list-row`, `review-list-row`, `experience-list-row` + `student-simple-row`; `className="grow"` 18곳, `chevron-right` 27곳.
  - 메타 줄 ‘… · 할 일 N개’ 직접 이어 붙이기 6곳 이상(F-5).
  - 확인 창: `FormDialog`(16곳)와 손으로 만든 `Dialog`+‘~할까요?’ 제목(RecordingPanel.tsx:658, PermanentResearchDelete.tsx:59, SavedTranscript.tsx:242, AuthPages.tsx:525, ReviewsPage.tsx:552, ReviewDetailPage.tsx:1148)이 섞임.
- 왜: 같은 동작의 문구·간격·움직임이 화면마다 달라지는 원인(G-1, G-4, G-7).
- 제안: `ErrorNotice`·`AnimatedList` 하나로 합치기. `ListRow`(제목·보조·메타·상태 배지·화살표 슬롯; 상태는 Montage `ContentBadge`), `MetaList`(F-5), `ConfirmDialog`(Montage Modal, 제목 질문·설명·[취소][동사]; `FormNavigationGuard`가 찾는 ‘취소’ 글자 유지 — ux-writing §6 개발 시 주의).
- 비용: 중간
- 같은 문제가 있는 다른 곳: —

### [K-5] 테스트 공백(E2E 없음, 문서가 말하는 테스트 일부가 없음)
- 위치: `apps/home-preview/tests/`(14개: adversarial-feasibility, assistant-presentation, controls, design-system, document-pdf, experience-render, go-shortcuts, marketing-interactions, memo-draft, password-change, recording-transcript, setup-dom, sites-worker, task-completion, version-compare), `src/**/*.test.ts` 17개(lib 위주), `supabase/tests/backend.test.mjs`
- 심각도: 보통
- 무엇 [코드 확인]:
  - E2E·시각 회귀 없음. Playwright·axe는 package.json에 없음. CI(`.github/workflows/repository-checks.yml`)는 typecheck·test·test:backend·build·test:sites만.
  - ui-quality.md §6이 “한글 조합 중 Enter … (테스트: `tests/controls.test.tsx`)”라 하지만 controls.test.tsx는 선택 상자·필터 3개 테스트뿐이고, 저장소 전체 테스트에 composition/`isComposing` 검사가 없음.
  - 교수 결과 ‘추가 수정 필요’의 이유 필수는 서버 테스트에만 있음(backend.test.mjs:69). 화면 쪽(ReviewDetailPage), 완전 삭제 이름 확인(PermanentResearchDelete), FeedbackPage·MeetingsPage·SettingsPage, ⌘K 팔레트 렌더링은 프런트 테스트 없음(command-items 로직만 있음).
  - CHANGELOG ‘16개 화면 계산된 스타일 비교 차이 없음’, ui-quality §6 ‘5개 너비 × 라이트·다크 × 21개 화면’ 검수에 쓴 스크립트가 저장소에 없어 다시 돌릴 수 없음.
- 왜: AGENTS ‘미실행 검사를 성공으로 보고하지 않는다’, 회귀를 다시 확인할 수단이 필요.
- 제안: (1) IME Enter 테스트 추가(`fireEvent.keyDown(el, { key:'Enter', isComposing:true })`로 전송 안 됨 확인), (2) ReviewDetailPage ‘추가 수정 필요’ 빈 이유 제출 막힘, (3) K-6 회귀 그물.
- 비용: 중간
- 같은 문제가 있는 다른 곳: —

### [K-6] 회귀 그물 스크립트 제안(Playwright 스크린샷 + getComputedStyle JSON 비교)
- 위치: 제안 `apps/home-preview/scripts/qa/`(새 폴더), 결과 `apps/home-preview/.qa/`(gitignore)
- 심각도: 보통
- 무엇: 위 K-2·K-3 정리와 F 항목 수정이 “보기에는 같은지”를 사람이 21화면 × 5너비 × 2테마로 다시 볼 수는 없음. 이전에 같은 일을 한 도구는 커밋되지 않음(K-5).
- 왜: ui-quality §5가 이미 Playwright·axe·자동 검사 목록을 기준으로 정해 둠. 도구가 저장소에 있어야 다른 작업자도 같은 기준으로 확인 가능.
- 제안 — **저장소에 둠(스크립트·경로 목록만), 스크린샷·기준 JSON은 커밋하지 않음**:
  - 파일: `scripts/qa/routes.json`(화면 목록), `scripts/qa/snapshot.mjs`(수집), `scripts/qa/diff.mjs`(비교). devDependency `@playwright/test`, `@axe-core/playwright`. `package.json`에 `qa:snapshot`, `qa:diff`.
  - 실행 환경: 미리보기 모드(`VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY=`, ui-quality §1). 미리보기 연구 ID가 브라우저마다 새로 생기므로 `/r`에서 첫 연구를 눌러 주소를 얻은 뒤 상대 경로로 이동. `page.clock.setFixedTime()`으로 날짜 고정(주간 띠·‘3일 뒤’·기한 지남이 흔들리지 않게), `reducedMotion: 'reduce'`, 테마는 쿠키 `margin-theme`로 지정, 폰트 로드 대기(`document.fonts.ready`).
  - 축: 너비 360·390·768·1024·1440 × 라이트·다크 × routes.json(공개·로그인·연구 홈·계획·미팅·글쓰기·피드백·할 일·자료·수정 결과·검토 목록·교수 검토 상세·연구 도우미·설정 등 21개).
  - 수집: 전체 화면 PNG + 계산된 스타일 JSON. 요소 키는 해시 클래스(Montage Emotion) 대신 `role+접근성 이름+순번` 경로. 속성: font-size, line-height, font-weight, color, background-color, border-radius, padding, margin, gap, width, height, display, grid-template-columns, flex-wrap, white-space, word-break, overflow-wrap, text-overflow, -webkit-line-clamp, overflow.
  - 자동 검사(ui-quality §5 그대로): 마지막 줄 한두 글자(Range 줄 상자 폭 < 글자 크기×2.3), `scrollWidth > clientWidth`인 말줄임·clamp 요소, 가로 스크롤, 화면 밖 글자, 24px 미만 대상, 보이는 글자 ⊄ 접근성 이름, axe 위반.
  - 비교: `main`에서 만든 JSON을 기준으로 PR과 속성 차이만 표로, 스크린샷은 픽셀 차이 비율만 보고.
  - CI: `.github/workflows/visual-check.yml`을 `workflow_dispatch`·라벨로만 실행, 결과는 artifact 업로드. 처음에는 필수 검사로 두지 않음.
  - 한계: 결과는 사람이 확인할 출발점(ui-quality §5 ‘자동 검사는 시작점’, AGENTS ‘사용자가 시각 검증 담당’). 실제 서버·실제 마이크·실제 AI 검증을 대신하지 않음. 이 컴퓨터에는 Node가 없어 CI나 사용자 컴퓨터에서 실행해야 함.
- 비용: 중간
- 같은 문제가 있는 다른 곳: —

---

## 실행하지 않은 것
- typecheck, test, test:backend, test:sites, build: 실행 안 함(Node 없음).
- 브라우저 렌더링·스크린샷·동작 줄이기 실제 확인: 안 함. 모든 시각 판단은 [추측].
- Montage 패키지 값(caption2 크기, 동작 토큰 유무, 부품 내부 아이콘·움직임): `node_modules`가 없어 확인 못 함.
