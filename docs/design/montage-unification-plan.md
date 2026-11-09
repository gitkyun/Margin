# Montage 통일 계획 (2026-11-09)

대상: `apps/home-preview` 전체. 기준: Wanted Montage 4.2.0(설치본 `@montage-ui/core`)과 Figma Wanted DS(Action·Color·Typography 페이지).
원칙: 모양은 Montage 부품이 맡고, 마진 CSS는 배치와 마진만의 화면(랜딩, 글쓰기 편집기, 큰 캘린더)만 맡는다. 새 부품을 손으로 만들지 않는다.

## 0. 지금 상태 요약 (조사 결과)

| 영역 | 지금 | 문제 |
|---|---|---|
| CSS 구조 | 레이어 없는 앱 CSS 12개 + 페이지 CSS. 같은 선택자를 3개 이상 파일이 덮는 곳 199개(셸 묶음만 27개) | Montage는 클래스 1개짜리 Emotion 규칙이라 `.x a` 같은 앱 규칙이 늘 이김 → 라이트 모드 주버튼 글자 검정(`research-home.css:17`) |
| 글자 크기 | px 직접 지정 869곳, 눈금 밖 값 13종(10, 9, 12.5, 23, 21, 13.5…) | Montage 눈금(display1~caption2)과 어긋남 |
| 굵기 | 550, 650, 450, 750, 630 등 | Montage는 400/500/600(제목류 700)만 |
| 숫자 글꼴 | `--font-mono`(SF Mono) 9곳 + 전역 `tabular-nums` 27곳 | 숫자만 다른 글꼴처럼 보임. Montage는 숫자 설정이 없음(Pretendard 기본 숫자) |
| 모서리 | 눈금 밖 9, 7, 6, 5, 11, 18, 3, 13, 15, 2 | Montage 4·8·10·12·14·16·20·24 |
| 간격 | 직접 값 약 1,800곳, 토큰 57곳 | |
| 중단점 | 눈금 밖 50곳(600, 1100, 800, 480…) | Montage 768·992·1200·1600 |
| 별칭 토큰 | 같은 색을 가리키는 별칭 11쌍 | brand/brand-ink/tone-blue, hover-fill/surface-muted/surface-soft 등 |
| 버튼 | 기본 HTML 버튼 66개(`.rms-action` 10, `.icon-button` 7, `.lp-button` 5, 글자 링크 12, 단발 15) | 높이·굵기·모서리가 제각각 |
| 입력 | 체크박스 14, 라디오 3, 날짜 입력 9, 스위치 1, 자체 선택 상자 32곳 | 브라우저 기본 날짜 달력이 그대로 노출 |
| 대화상자 | Radix Dialog 26, Sheet 2, DropdownMenu 3 | Montage Modal·Menu와 모양 다름 |
| 배지·탭·빈 화면·로딩 | StatusBadge 30곳(CSS 6개 파일), 탭 4종, EmptyState 24, 스켈레톤 8 | |
| 아이콘 | Disarto 65종 341곳 + lucide(편집기 도구막대, Radix 래퍼) | `@montage-ui/icon` 설치만 됨 |
| 달력 | 큰 달력 FullCalendar(색 `#2466cc` 하드코딩) + 브라우저 날짜 입력 | 두 모양이 서로, 그리고 Montage와 다름 |
| 상태 불일치 | 홈에서 체크 해제 → `todo`, 할 일 화면 → `doing` | `lib/task-status.ts toggleDone`로 하나로 |

## 1. 단계별 작업

순서는 "보이는 버그 → 바닥 공사 → 부품 교체 → 새 기능"이다. 단계마다 typecheck, test, test:backend, test:sites, build를 돌리고 CHANGELOG를 적는다.

### 1단계. 바로 보이는 버그 (작은 범위)

- 라이트 주버튼 글자 검정: `.rh-home a { color: inherit }` 제거. 같은 꼴 규칙도 정리한다. `expansion.css:752` 검토 댓글 `!important`, `:1457 .source-picker > button`, `experience.css:2073·2082 .research-view-switch button`, `.rms-calendar a`, `.experience-list-row a`, `.work-tabs a`, `.archive-banner a`, `.tabs-line a`.
- 홈 할 일 체크 해제를 `toggleDone`으로 맞춤.

### 2단계. CSS 구조: 캐스케이드 레이어

- `main.tsx`의 앱 CSS를 `@layer margin.base, margin.app`로 감싼다(`@import "./styles.css" layer(margin.app)` 형태). Montage(Emotion, 레이어 없음)는 항상 앱 CSS를 이긴다. 1단계 같은 버그가 구조적으로 다시 생기지 않는다.
- Montage를 일부러 고치는 규칙과 FullCalendar·sonner 테마는 `src/design/montage.css` 하나(레이어 없음)에 모은다. 이름은 AGENTS.md 금지 꼴(`*-refinements.css`)이 아니다. 대신 기존 `workspace-refinements.css`를 각 화면 CSS로 흩어 없앤다.
- 셸(`.floating-workspace`) 27개 중복 선택자를 한 파일로 합친다.

### 3단계. 토큰과 글자

- 글자: 눈금 밖 크기를 가장 가까운 Montage 단계로 옮기고, `--typography-*` 변수로만 쓴다. 굵기는 400/500/600/700만.
- 숫자: `--font-mono`와 전역 `tabular-nums` 삭제. 숫자는 Pretendard 그대로. 자릿수가 흔들리면 안 되는 곳(녹음 타이머, 업로드 %, 표의 숫자 열)에만 `tabular-nums`.
- 모서리·간격·중단점: Montage 눈금으로 옮김. 중단점은 `design/responsive.ts`의 `queryUp`/`queryDown`만.
- 별칭: 11쌍을 하나씩 남기고 나머지는 지움. `tokens.css`에는 Montage에 없는 것(캔버스, 사이드바, 선택 채움, 다크 예외)만 남긴다.

### 4단계. 부품을 Montage로 교체

| 지금 | 바꿀 Montage | 비고 |
|---|---|---|
| 기본 버튼, `.rms-action`, `.lp-button` | Button(solid primary / solid assistive / outlined assistive), TextButton, IconButton | Figma 위계: 주행동 1개만 solid primary |
| `Choice`, `SelectField` | Select | |
| 체크박스·라디오·스위치 | Checkbox, Radio, Switch | |
| 날짜·시간 입력 9곳 | DatePicker, TimePicker | 아래 5단계 |
| Radix Dialog·Sheet | Modal(popup / bottom) | 닫을 때 원래 버튼으로 포커스 복귀 확인 |
| 확인 대화상자 | Alert | |
| DropdownMenu | Menu | |
| StatusBadge, `.rh-badge`, `.rms-pill` | ContentBadge | 상태별 accent 색 표 하나로 |
| count-chip, segment-count | PushBadge(text) | |
| `.context-chip`, `.review-file-chip` | Chip | |
| `.tabs-line`, `.review-mobile-tabs` | Tab / TabList | 링크 이동(`.work-tabs`, 설정 메뉴)은 그대로 링크 |
| `.rh-scope`, `.theme-switch`, `.folder-all` | SegmentedControl(`Segments`) | |
| EmptyState | FallbackView | |
| LoadingState, HomeSkeleton | Skeleton | |
| 글쓰기 DockItem 툴팁 | Tooltip(`Hint`) | |

알림(toast)은 sonner를 유지하고 Montage Toast 명세(반투명 inverse, radius 12, body2 bold)에 맞춰 테마만 입힌다. Montage Toast는 대기열·타이머가 없고, 다크 모드에서 흰 바탕에 흰 글자가 되는 문제가 있다.

아이콘은 기본값으로 Disarto를 유지하고 lucide만 Disarto로 바꾼다. 341곳을 Montage 아이콘으로 바꾸는 건 그림이 비슷하지 않은 아이콘이 많아 별도 판단이 필요하다.

### 5단계. 달력 통일

- 입력 칸의 작은 달력: Montage DatePicker/TimePicker(형식 `YYYY.MM.DD`, `a hh:mm`, ko). 브라우저 기본 달력을 없앤다.
- 큰 달력(PlanningPage): FullCalendar 유지. `#2466cc` 같은 색을 지우고 Montage 토큰으로 테마를 다시 입힌다(오늘 = brand 8% 원, 선택 = brand 채움, 다른 달 = quaternary 글자. DateCalendar와 같은 규칙).
- 점이 찍히는 작은 월 달력이 필요할 때만 react-day-picker v10을 `--rdp-*` 변수로 Montage 색에 맞춘다. Montage DateCalendar에는 날짜 칸 슬롯이 없다.

### 6단계. 새 기능 5개

| 기능 | 라이브러리 | 내용 |
|---|---|---|
| ⌘K 명령 팔레트 | cmdk(13k★) + es-hangul(토스) | 기록 찾기 + "미팅 만들기", "할 일 추가", "글 새로 쓰기", 화면 이동, 테마 바꾸기. 초성 검색(ㅁㅌ → 미팅). 빈 입력이면 최근 항목·자주 쓰는 동작. 행 오른쪽에 단축키. 위쪽 18% 위치, 폭 600. 한글 조합 중 Enter 무시 |
| 할 일 완료 | motion `AnimatePresence` + sonner action | 체크 → 줄 긋기 400ms 유지 → 접힘. "완료했어요 · 되돌리기" 6초, ⌘Z로도 되돌림. 되돌리기는 `save`가 돌려준 기록으로 |
| 홈 주간 띠 | 직접 조합(date-fns + Montage 토큰) | '다음 미팅' 위 7일. 작은 요일 + 큰 날짜, 오늘은 brand 원, 미팅·마감 점(최대 3), 날짜를 누르면 그날 기록. 방향키로 날짜 이동, 주 넘기기 |
| 기능 카드 펼침 | motion `layout` | 소개 페이지 기능 카드에 올리면(키보드는 포커스) `ProductPreview` 일부가 펼쳐짐. 동작 줄이기 설정이면 펼침 없이 바로 표시 |
| 버전 비교 슬라이더 | react-compare-slider v4(3.4KB) | 글쓰기 버전 대화상자에서 이전/지금을 좌우로 끌어 비교. 키보드 5% 이동. 소개 페이지 `ComparePreview`도 같은 부품으로 바꿔 하나로 |

### 7단계. 리서치에서 나온 추가 제안

- @number-flow/react: 홈 숫자(남은 할 일, 진행률)가 바뀔 때 숫자가 굴러가며 바뀜.
- @formkit/auto-animate: 할 일·자료 목록의 추가·삭제·정렬에 한 줄로 움직임.
- react-hotkeys-hook: `N` 새 기록, `G H` 홈 같은 이동 단축키. 한글 조합 중에는 무시하도록 설정.
- 연구 도우미 입력창: 비었을 때 가운데, 대화가 시작되면 아래에 붙기. 보내기 버튼은 비면 꺼지고 답이 오는 동안 '멈추기'로 바뀜. 한글 조합 중 Enter 보내기 방지 확인.
- 쓰지 않을 것: vaul(관리 중단), kbar(cmdk보다 크고 느슨함), Aceternity/Magic UI 설치(참고만 하고 토큰으로 다시 씀).

## 2. 범위 밖 / 지키는 것

- 랜딩 Cloud Shader 유지, 로그인 뒤에는 유리·굴절 효과 없음.
- DB 필드·API는 바꾸지 않음. 문구는 해요체와 `ux-writing.md` 용어집.
- 실제 연구 데이터, 마이크 사용 없음. 화면 확인은 사용자가 최종으로 함.

## 3. 커밋 단위

1단계 → 2단계 → 3단계 → 4단계(부품 묶음별) → 5단계 → 6단계(기능별)로 나눠 커밋한다. 지금 브랜치(`design/montage-polish-dark-hierarchy`)의 미커밋 다듬기 작업을 먼저 한 커밋으로 묶어 두면 이후 변경과 섞이지 않는다.
