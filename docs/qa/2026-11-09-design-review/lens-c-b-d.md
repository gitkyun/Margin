# 마진 디자인 시스템 검토 — 렌즈 C·B·D
> 이 부록은 코드만 읽어 작성했어요(작성 시점에는 렌더링 없음). 이후 데모 모드 실제 화면(헤드리스 Chrome)과 계산된 스타일로 막힘·높음과 [추측] 항목을 다시 확인했고, 판정은 각 항목의 `- 반박 검증:` 줄과 [보고서 본문](../2026-11-09-design-review.md) §5에 적었어요.


- 대상: `apps/home-preview` (기준 커밋 `e6589b9`, `main`, 작업 트리 깨끗함)
- 방법: 소스만 읽음(grep, git grep, Python 정적 파서). Node가 없어서 렌더링, 빌드, 테스트는 하나도 돌리지 않았다. **화면을 눈으로 확인한 결과는 없다.** 각 발견에 [코드 확인]은 코드를 직접 읽은 것, [추측]은 Montage 토큰 실제 값이나 렌더 결과를 짐작한 것을 뜻한다.
- Montage 패키지(`@montage-ui/core/theme.css`)가 이 컴퓨터에 없어서 시맨틱 토큰의 실제 hex 값과 `--radius-full`·`--radius-28`·`--spacing-6/10/14/2` 같은 토큰이 실제로 있는지는 확인하지 못했다.
- 명령은 모두 `apps/home-preview`에서 실행한다. **주의: `git grep -E`는 `\s`와 `\b`를 지원하지 않는다**(처음 집계가 0으로 나와서 알게 됨). 그래서 `[[:space:]]`를 쓰거나 Python으로 셌다.

---

## C. 디자인 시스템 준수 기준선

### 기준선 숫자표

| # | 지표 | 수 | 재현 명령 | 위쪽 파일 |
|---|---|---|---|---|
| 1 | 직접 쓴 색(hex·rgb()·rgba()·hsl(), 숫자로 시작). `rgba(var(--…-rgb))`는 제외 | **61곳 / 9개 파일**. 브랜드 그림 약 40, 그 밖 약 21 | 아래 C-1의 Python 한 줄 | public-site.css 20 · FooterGlyphField.tsx 16 · document-pdf.tsx 7 · PublicPages.tsx 6 · marketing-effects.css 5 · CloudShader.tsx 3 |
| 1a | 그중 CSS | 26 (migration.md의 "26곳"과 같음) | 같음 | public-site 20, marketing-effects 5, brand 1 |
| 2 | font-size 선언 전체 / `var(--typography-*)` 아님 | 879 / **36** | `git grep -nE "font-size *:" -- 'src/*.css' 'src/**/*.css' \| grep -v "var(--typography" \| wc -l` | public-site 25 · brand.css 5 · styles 2 · screens·research-home·experience·marketing-effects 각 1 |
| 3 | border-radius 전체 / 토큰 / 토큰도 아니고 예외(0·50%·999px·inherit)도 아님 | 373 / 324 / **3** | `git grep -nE "border(-[a-z-]+)?-radius *:" -- 'src/*.css' 'src/**/*.css' \| grep -v "var(--radius" \| grep -vE "radius *: *(0\|50%\|999px\|inherit\|9999px);"` | brand.css:89 `27%` · expansion.css:102 `100%` · public-site.css:1495 `0.05em` |
| 4 | gap·padding·margin 선언 2,136개 중 직접 px 사용 / `var(--spacing-*)` 사용 | 선언 **1,839 / 88**. 값 개수로는 px 2,226 / 토큰 115. 홀수·소수 px 548 | `R='^[[:space:]]*(gap\|row-gap\|column-gap\|padding\|padding-[a-z-]+\|margin\|margin-[a-z-]+)[[:space:]]*:'; git grep -cE "$R.*[1-9][0-9.]*px" -- 'src/*.css' 'src/**/*.css'` (토큰은 `.*var\(--spacing`) | experience 276 · public-site 265 · expansion 242 · styles 231 · student 191 · reviews 158 · research-home 128 |
| 5 | TSX의 날 `<button>` (Montage·ui/button 밖) | **41 + `motion.button` 2** | `git grep -nE "<button[[:space:]>]\|<button$" -- 'src/**/*.tsx' 'src/*.tsx'` / `git grep -n "<motion.button"` | ReviewDetailPage 7 · ResearchAssistant 6 · WorkspaceShell 6 · MaterialFolders 5 · PublicPages 4 |
| 5a | 손으로 만든 토글(`aria-pressed`) / `role="group"` 선택 묶음 | 11곳 / 7개 파일 · 6곳 | `git grep -n "aria-pressed" -- 'src/**/*.tsx'` | MaterialFolders 3, PublicPages 3 |
| 6 | `[data-theme="dark"]` 규칙 / `.dark` | **규칙 12개**(+Tailwind `@custom-variant dark` 1, 쓰는 곳 0) / `.dark` 0 | `git grep -n 'data-theme="dark"' -- 'src/*.css' 'src/**/*.css'` | public-site 6, brand 2, montage 1(선택자 2), tokens 1, styles 1, research-home 1 |
| 7 | `design/montage.css` 규칙 | **35개**. Montage 부품을 직접 고치는 것 13, 외부(FullCalendar·sonner) 9, 앱 자체 부품 13 | Python 파서(C-7) | — |
| 8 | `@layer margin` 밖에 있는 앱 CSS | 0 (styles.css 맨 위 Tailwind 지시문 4개, tokens.css, montage.css는 일부러 밖에 둠). 다만 레이어 안 `!important` **82개** | `python3 -I outside.py $(git ls-files 'src/*.css' 'src/**/*.css')` / `git grep -c "!important"` | research-home 25, experience 17, expansion 14 |
| 9 | tokens.css 별칭 | 30개 정의(색·그림자 별칭 28 + 배치 2). 값이 완전히 같은 쌍 2개 | 아래 C-9 | `--text-secondary` 379, `--line` 321, `--brand` 159, `--surface` 158 |

C-1 Python 한 줄:
```
python3 -I -c 'import re,sys;p=re.compile(r"#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])|\b(?:rgba?|hsla?)\(\s*[0-9.]");[print(f,i,l.strip()[:100]) for f in sys.argv[1:] for i,l in enumerate(open(f),1) if p.search(l) and not l.strip().startswith(("//","*"))]' $(git ls-files 'src/*.css' 'src/**/*.css' 'src/**/*.tsx' 'src/**/*.ts' | grep -v '\.test\.')
```

---

### [C-1] 브랜드 그림이 아닌 곳에 직접 쓴 색이 남아 있음 [코드 확인]
- 위치: 소개 화면 마지막 CTA 띠 · 전체 너비 · 라이트·다크 / `src/pages/public-site.css:1319-1324`(`.lp-close`), `:261`(`.lp-hero-stage::after`), `src/components/marketing/MarketingEffects.tsx:60,117`, `src/components/RecordingPanel.tsx:250`, `src/lib/document-pdf.tsx:21-83`
- 심각도: 보통
- 무엇: `.lp-close` 배경이 `#3da4f8a6`, `#297bf0`, `#1047c6`, `#0864e2`, `#154abd` 그라데이션이고 테두리는 `#2d71dd`이다. 히어로 무대 덮개는 `#f0f7ff1a`, 합치기 애니메이션 선은 `stroke="#3685ff"`, 스포트라이트는 `rgba(83,143,255,.16)`, 녹음 파형 대체 색은 `#0066ff`, PDF 내보내기 색은 7곳이다. README가 허용한 예외는 Cloud Shader, 마스코트, 푸터 칸 글자 그림뿐인데 CTA 띠·히어로 덮개·애니메이션은 이 목록에 없다.
- 왜: README 「색」 항목의 "hex·rgb 값을 새로 쓰지 않습니다"와 허용 목록을 어긴다. 다크에서도 `.lp-close` 색이 그대로라서 테마를 따르지 않는다.
- 제안: `.lp-close`는 `--semantic-surface-brand-primary`·`--semantic-surface-brand-strong`과 `rgba(var(--semantic-surface-brand-primary-rgb), var(--opacity-*))` 그라데이션으로 바꾼다. 장식 선은 `var(--semantic-foreground-brand-primary)`로. RecordingPanel 대체 색은 `--semantic-surface-brand-primary`를 읽게 한다. PDF는 화면 밖 출력이므로 README에 예외로 적는다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 쓰이지 않는 `.rms-assistant-glyph`(`marketing-effects.css:113-115`)와 `.lp-assistant-face`(`public-site.css:437-442`)에 연한 하늘색 hex 그라데이션이 있고 다크 변형이 없다(C-13).

### [C-2] 글자 크기 10px·9px가 남아 CHANGELOG 내용과 어긋남 [코드 확인]
- 위치: 소개 화면 데모 창 · 전체 너비 · 두 테마 / `src/pages/public-site.css:340,471,484,501,520,525(9px),532,566,591,785,810,818(9px),869,874,1805,1842,1845,2034`, `src/components/marketing/marketing-effects.css:268`
- 심각도: 보통
- 무엇: `font-size: 10px`가 17곳, `9px`가 2곳이다. CHANGELOG에는 "9·10·12.5·13.5·23px 같은 눈금 밖 값 제거"와 "9~11px 라벨을 11~12px로 키움"이 적혀 있다. 그 밖에 `clamp()` 큰 제목 8곳(public-site 220·1331·1766·2065, experience.css:120, research-home.css:58)과 `72px`·`64px`·`100px`도 토큰이 아니다.
- 왜: CHANGELOG가 사실과 다르다. Montage 가장 작은 단계(caption2)보다 작은 글자가 데모 안에 남아 있다.
- 제안: 데모 라벨은 `--typography-caption2-fontSize`로 바꾼다. 제목 clamp는 `--typography-display1/2/3-fontSize`를 너비별로 고르는 방식으로 바꾼다. research-home.css:58은 로그인 후 화면이므로 `--typography-title2`나 `--typography-title3` 중 하나로 고정한다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: C-3

### [C-3] brand.css에 앱 화면 규칙이 섞여 있고 글자·여백이 직접 값임 [코드 확인]
- 위치: 연구 도우미·AI 작업대 · 전체 · 두 테마 / `src/components/brand/brand.css:121-211` (`.margin-depth-help` 136, `.margin-result-note` 142-160, `.margin-review-settings` 178-, `.margin-review-fields small` 207)
- 심각도: 낮음
- 무엇: 브랜드 파일에 `font-size: 12px/14px/13px`, `line-height: 1.65`, `padding: 6px 2px 0` 같은 값이 있다. 이 규칙은 `ResearchAssistant.tsx:993`과 `AIWorkbench.tsx:300`에서 쓴다.
- 왜: 브랜드 그림 예외는 색에만 해당하는데, 이 파일에 있으면 앱 UI까지 예외처럼 보인다. 화면별 CSS에 둔다는 README 체크리스트 3항과도 맞지 않는다.
- 제안: `pages/assistant.css`와 `student.css`로 옮기고 `--typography-caption1-*`, `--typography-label1-*`, `--spacing-*`로 바꾼다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 없음

### [C-4] 간격이 거의 전부 직접 px임 (1,839 대 88) [코드 확인]
- 위치: 앱 전체 / experience.css 276 · public-site.css 265 · expansion.css 242 · styles.css 231 · student.css 191 · reviews.css 158 · research-home.css 128
- 심각도: 보통
- 무엇: 값 2,226개 중 홀수·소수 px가 548개다(9px 64, 5px 61, 7px 58, 13px 48, 15px 46, 3px 41, 17px 41, 25px 40…). 토큰을 쓰는 파일은 assistant.css(31), week-strip.css(16), command-palette.css(12) 정도다.
- 왜: 통일 계획 3단계("모서리·간격·중단점: Montage 눈금으로")가 간격에서는 아직 시작되지 않았다. 계획 0절 수치(직접 1,800 / 토큰 57)와 비교하면 토큰이 조금 늘었을 뿐이다. migration.md 「남은 일」에는 간격 항목이 없다.
- 제안: `--spacing-4/8/12/16/20/24/32` 눈금으로 바꾼다. 홀수 값은 가장 가까운 짝수 단계로. 화면 하나씩 옮기며 계산된 스타일을 비교한다. migration.md 남은 일에 "간격" 항목을 추가한다.
- 비용: 큼
- 같은 문제가 있는 다른 곳: `line-height` 숫자 직접 값 44곳(토큰 220), `letter-spacing` 직접 값 13곳, `color-mix()` 38곳(README는 `rgba(var(--*-rgb), var(--opacity-*))`를 권장)

### [C-5] 직접 만든 버튼·토글이 남아 CHANGELOG와 어긋남, 교수 결과 선택이 네이티브 라디오 [코드 확인]
- 위치: 로그인 후 셸 · 전체 · 두 테마 / `src/components/WorkspaceShell.tsx:249,438,471`(`className="icon-button …"`), `:73,263,298`. 교수 검토 / `src/pages/reviews/ReviewDetailPage.tsx:792-830`(`.review-response-option` + `type="radio"`), `:103,110`(답글·해결로 표시), `:598`(`review-item-nav`). 자료 / `src/components/MaterialFolders.tsx:42,57,97,108,126`(`.folder-all` `aria-pressed`). 설정 / `src/pages/SettingsPage.tsx:126,449`. 회의 / `MeetingsPage.tsx:1173`. 도우미 / `ResearchAssistant.tsx:725,758,838,970,1032,1082`
- 심각도: 높음
- 반박 검증: 확인(코드). 교수 결과 선택이 네이티브 라디오인 점은 기능 문제는 아니라 보통으로 낮춤.
- 무엇: 날 `<button>` 41개와 `motion.button` 2개(`experience.tsx:244` DockItem, `MaterialUploadField.tsx:51`)가 있다. CHANGELOG는 "`.rms-action`·`.text-link`·`.icon-button` 등을 Montage Button·TextButton·IconButton으로 바꿈"이라고 적었지만 `icon-button` 클래스 버튼 3개와 CSS 규칙 12개가 남아 있다. 통일 계획 4단계에서 SegmentedControl로 바꾸기로 한 `.folder-all`은 아직 `aria-pressed` 날 버튼이다. 교수 결과('수정 내용 확인'·'추가 수정 필요')는 Montage Radio가 아니라 네이티브 라디오와 카드 CSS(`reviews.css:747-770`, `accent-color: var(--brand)`)로 되어 있다.
- 왜: 통일 계획 원칙 "새 부품을 손으로 만들지 않는다"와 4단계 표를 어긴다. 교수 결과는 제품 불변 조건의 핵심 상호작용인데 앱 다른 곳의 선택 모양(Montage Radio·Checkbox)과 다르다.
- 제안: 셸 아이콘 버튼은 `Button size="icon-sm" variant="ghost"`(IconButton normal)로. 답글·해결로 표시는 `TextButton color="assistive" size="small"`로. `.folder-all`은 `Segments`(SegmentedControl)로. 교수 결과는 Montage `Radio`나 `RadioGroup` + 카드 배치, 또는 SegmentedControl 2항목으로. 설정 메뉴는 링크 이동이라 링크로 둬도 되지만 선택 모양은 B-6 규칙을 따른다.
- 비용: 중간
- 같은 문제가 있는 다른 곳: 공개 화면 `PublicPages.tsx:396,557,792`, `WorkflowStack.tsx:92`(데모 탭·단계 고르기). `FooterControls.tsx:41`(푸터 테마 선택은 README에서 별도 허용했지만 앱의 `ThemeSwitch`=Segments와 모양이 다름)

### [C-6] 다크 전용 규칙이 문서에 적힌 수(9개)보다 많음 [코드 확인]
- 위치: 아래 목록
- 심각도: 낮음
- 무엇: `.dark` 선택자는 0개다(`FooterGlyphField.tsx:45`의 `dark:`는 JS 객체 키, `public-site.css:145,157,1558`의 `.lp-button-dark`는 클래스 이름). `[data-theme="dark"]` 규칙은 다음 12개다.
  1. `src/styles.css:43` color-scheme
  2. `src/design/tokens.css:74` 면 층위 15/17/22와 `--selected-fill` 16%
  3. `src/design/montage.css:55,58` SegmentedControl 선택 면 `--atomic-coolNeutral-30`
  4. `src/components/brand/brand.css:42` 라이트 로고 숨김
  5. `src/components/brand/brand.css:45` 다크 로고 표시
  6. `src/pages/public-site.css:153` `.lp-button-dark` → 브랜드 파랑
  7. `src/pages/public-site.css:157` 같은 버튼 호버
  8. `src/pages/public-site.css:1044` `.lp-stack-rail` 면·테두리
  9. `src/pages/public-site.css:1550` `.lp-footer` 그라데이션 `#25427f`(브랜드 그림)
  10. `src/pages/public-site.css:1561` `.lp-close > .lp-mark` `--atomic-blue-50`
  11. `src/pages/public-site.css:2227` `.lp-footer-bottom` hex 그라데이션(브랜드 그림)
  12. `src/pages/research-home.css:978` `.rh-assistant-symbol` 그림자 없앰

  이 밖에 `styles.css:8 @custom-variant dark`가 정의돼 있지만 TSX에서 `dark:` 유틸을 쓰는 곳은 0이다. JS에서 테마를 나누는 곳: `PublicPages.tsx:384-386`(Cloud Shader 색, 브랜드 그림), `FooterGlyphField.tsx:147`, `RoadmapDiagram.tsx:67 colorMode`.
- 왜: migration.md 1절 표는 "`[data-theme="dark"]` 9개"라고 적었다. 6·7번은 '같은 뜻 같은 색' 원칙을 깬다(B-1).
- 제안: 6·7번은 B-1 대안으로 없앤다. 쓰지 않는 `@custom-variant dark`는 지운다. migration.md 숫자를 고친다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: B-1, B-10

### [C-7] montage.css에 Montage를 고치지 않는 규칙이 섞여 있고 `.segment-count`가 두 번 정의됨 [코드 확인]
- 위치: `src/design/montage.css` (35개 규칙)
- 심각도: 보통
- 무엇: 대상별로 나누면 다음과 같다.
  - Montage SegmentedControl 6개(17·24·27·31 `!important`·36·55)
  - Montage Tab 5개(129·133·140·143 + `.margin-tab-count` 136)
  - Montage Modal 2개(`.command-palette` 193·197)
  - Montage Menu 3개(107·118·124)
  - Montage Button 1개(`.student-task-row > [data-slot="button"]` 101, display:none)
  - Montage Tooltip 내용 5개(`.margin-hint-*` 64-80)
  - FullCalendar 변수 1개(154)
  - sonner 8개(209-263)
  - 개수 배지 `.segment-count` 3개

  `.segment-count`는 39행(caption1·`--semantic-surface-neutral-secondary`·weight 600)과 83행(caption2·`--surface-sunken`·weight 500·inset 테두리) 두 번 나온다. 나중 것이 이기기 때문에 39행의 글자 크기·색 선언은 죽은 코드다. 레이어 밖 규칙에도 직접 값이 있다: `gap: 6px`, `padding: 0 5px`, `padding: 11px`, `opacity: 0.78`, `blur(32px)`, `width: 600px`, `14vh`.
- 왜: 파일 머리말의 "부품 모양을 일부러 바꿔야 할 때만 이 파일에" 원칙과 맞지 않는다. 레이어 밖 규칙은 모든 앱 CSS를 이기므로 앱 자체 부품(`.margin-hint-body`, `.segment-count`, `.margin-menu-label` 내부)까지 여기 두면 나중에 화면 CSS에서 고칠 수 없다.
- 제안: `.segment-count`를 하나로 합친다. Montage `PushBadge`(text)로 바꾸면 이 규칙이 아예 필요 없다(계획 4단계). `.margin-hint-body`와 `.margin-menu-label` 안쪽 글자처럼 Montage를 덮지 않는 규칙은 `@layer margin` 안 `components/ui/*.css`로 옮긴다. 직접 px는 `--spacing-*`, `--opacity-*`로 바꾼다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: `.student-task-row > [data-slot="button"]`는 README의 "data-slot 선택자는 배치에만"과 경계에 있다(display 숨김).

### [C-8] 레이어 안 `!important` 82개가 레이어 구조를 거꾸로 뚫음, 외부 CSS는 레이어 밖 [코드 확인]
- 위치: `src/expansion.css:903`(`.wide-dialog max-width:900px !important`), `src/pages/reviews/reviews.css:103,925`(`.review-compose-dialog`·`.review-settings-dialog` max-width), `src/pages/research-home.css` 25곳(`.rh-people`·`.rh-text-link` 등 `color … !important`), `src/pages/PlanningPage.tsx:3-4`(FullCalendar CSS), `src/pages/RoadmapDiagram.tsx:10`(`@xyflow/react/dist/style.css`)
- 심각도: 보통
- 무엇: 캐스케이드 레이어에서는 `!important`의 우선순위가 뒤집혀서, `@layer margin` 안의 `!important`가 레이어 밖 Montage(Emotion)의 일반 선언을 이긴다. `.wide-dialog`(WritingPage.tsx:728·775·918)와 검토 대화상자 2개는 Montage Modal의 너비를 이 방법으로 덮는다. montage.css 한 곳에 모은다는 원칙 밖이다. 반대로 FullCalendar·xyflow의 CSS는 레이어 없이 들어오므로 앱 CSS(`.roadmap-diagram` 등, `expansion.css:1078`)는 그 규칙을 이기지 못한다.
- 왜: CHANGELOG "Montage 부품 모양(레이어 없음)이 항상 이기도록"이 `!important`에서는 성립하지 않는다. 앞으로도 같은 꼴의 버그가 다시 생길 수 있다.
- 제안: Modal 너비는 Montage `Modal` 크기 prop이나 montage.css의 `[data-component]` 규칙으로 옮긴다. `.rh-*` 링크의 `display/color !important`는 레이어 구조에서는 필요 없으니 지운다(옛 `.rh-home a` 대응의 흔적). 외부 CSS는 `@import "…" layer(vendor)`로 감싸 레이어 순서(`vendor, margin`)를 정하는 방안을 검토한다.
- 비용: 중간
- 같은 문제가 있는 다른 곳: `styles.css:1948`, `experience.css:1941`, `expansion.css:831`, `public-site.css:2041`. 동작 줄이기용 전역 `!important`가 4벌 중복된다.

### [C-9] tokens.css 별칭 28개가 남아 있고, 값이 같은 쌍과 migration 표가 맞지 않음 [코드 확인]
- 위치: `src/design/tokens.css:20-71`, `docs/design/migration.md` 2절 표
- 심각도: 낮음
- 무엇: 사용 횟수(CSS+TSX `var(--x)`): `--text-secondary` 379, `--line` 321, `--brand` 159, `--surface` 158, `--text` 121, `--surface-muted` 113, `--text-tertiary` 79, `--brand-soft` 51, `--primary` 34, `--line-strong` 26, `--danger` 21, `--success` 19, `--hover-line` 16, `--warning` 14, `--canvas` 12, `--hover-fill` 11, `--selected-line` 11, `--selected-fill` 8, `--danger-soft`·`--danger-line` 5, `--surface-sunken`·`--sidebar` 4, `--surface-raised`·`--topbar`·`--raise-shadow` 3, `--tone-gray` 2, `--panel-shadow`·`--shadow-pop` 1. 값이 같은 쌍: `--sidebar` ≡ `--surface`(두 테마 모두), `--hover-fill` ≡ `--surface-muted`. migration.md 표에는 이미 없어진 `--border`·`--muted`·`--surface-soft`·`--primary-soft`·`--glass`·`--brand-ink`·`--tone-*`·`--input-line`가 사용 횟수와 함께 남아 있다.
- 왜: 계획 3단계 "tokens.css에는 Montage에 없는 것만" 목표와 어긋나고 문서도 낡았다.
- 제안: `--sidebar`·`--panel-shadow`·`--shadow-pop`·`--tone-gray`처럼 적게 쓰는 것부터 `--semantic-*`로 바꾸고 지운다. `--success/--warning/--danger`는 `--semantic-foreground-positive/cautionary/negative-primary`로. migration.md 표를 지금 상태로 다시 쓴다.
- 비용: 중간
- 같은 문제가 있는 다른 곳: D-7(별칭 이름이 역할을 숨겨서 생기는 오용)

### [C-10] "기본 스위치 규칙 삭제"라는 CHANGELOG와 달리 손으로 만든 스위치 CSS 두 벌이 남아 있음 [코드 확인 / 효과는 추측]
- 위치: 설정 → 알림 · 전체 · 두 테마 / `src/expansion.css:1514-1540`(전역 `input[role="switch"]` + `:before`), `src/pages/screens.css:483-515,708`(`.preferences-list input[role="switch"]` + `::after`)
- 심각도: 보통
- 무엇: 설정 알림은 이미 Montage `Switch`를 쓴다(`SettingsPage.tsx:370`). 그런데 전역 `input[role="switch"] { appearance:none; width:40px; … }`와 `::before` 손잡이 그리기가 아직 있다.
- 왜: Montage Switch가 안쪽에 `input[role="switch"]`를 그린다면 Montage가 정하지 않은 속성(의사요소 `::before/::after` 내용·위치)이 앱 레이어에서 적용돼 손잡이가 두 개로 보일 수 있다 [추측, 렌더 미확인]. 그렇지 않더라도 CHANGELOG 내용과 다르다.
- 제안: 두 블록을 지운다. 스위치 모양은 Montage `Switch`만 맡게 한다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: `.rh-task input`(research-home.css:558), `.student-task-row input[type="checkbox"]`(student.css:1062)도 이미 Montage `Checkbox`로 바뀐 자리에 너비·`accent-color`가 남아 있다.

### [C-11] 문서와 CHANGELOG의 서로 맞지 않는 주장 [코드 확인]
- 위치: `docs/design/README.md` 「컴포넌트」, `docs/design/migration.md` 3절 4항, `CHANGELOG.md` Unreleased
- 심각도: 낮음
- 무엇:
  - README와 migration은 "대화상자·시트·메뉴는 아직 Radix 래퍼(`dialog.jsx`)"라고 하지만, 실제 `src/components/ui/dialog.tsx`는 Montage `Modal`을 쓴다.
  - CHANGELOG 아래쪽의 "보조 글자·선택 메뉴·탭 대비를 4.5:1 이상으로"는 2026-11-09 결정("WCAG 대비 수치는 기준에서 뺌", `--text-tertiary` 보정색 삭제)과 맞지 않는다. 지금 대비는 측정되지 않았다.
  - migration은 "직접 쓴 색 26곳(장식)"이라고 하지만 CTA 띠와 히어로 덮개는 장식 허용 목록 밖이다(C-1).
  - CHANGELOG "알림이 다크 테마에서도 다크로 표시됨"과 새 Toast 규칙(반전 면)이 다크에서 어떻게 보일지가 충돌할 수 있다(B-2).
- 왜: 이 기록을 보고 판단할 사람(공동작업자, 교수 검토자)을 잘못 이끈다.
- 제안: 문서 표를 지금 코드에 맞춰 고치고, 대비 항목은 "측정 안 함"으로 바꾼다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: C-2, C-5, C-6, C-10

### [C-12] 시맨틱이 아닌 atomic 토큰을 직접 씀 [코드 확인]
- 위치: `src/design/tokens.css:75-79`(coolNeutral-15/17/22, 문서화된 예외), `src/design/montage.css:60`(coolNeutral-30), `src/pages/public-site.css:1555,1559,1562`(`--atomic-blue-30/95/50`)
- 심각도: 낮음
- 무엇: 규칙상 허용된 것은 `--semantic-*`, `--typography-*`, `--radius-*`, `--spacing-*`다. tokens.css의 다크 층위는 migration 2-1에 결정으로 적혀 있지만, montage.css의 coolNeutral-30은 네 번째 다크 면 단계를 새로 만들고 public-site의 atomic-blue 3개는 문서에 없다.
- 왜: 다크 면 층위를 "15·17·22 한 곳"에서만 정한다는 결정과 어긋나고, 테마가 바뀌어도 값이 고정된다.
- 제안: SegmentedControl 선택 면은 `--surface-raised`(22)나 `--semantic-surface-elevated-primary`로 맞춘다. `.lp-close` 버튼은 B-1 대안 A의 '흰 버튼' 규칙 하나로 정리한다(`--semantic-static-white` + `--semantic-foreground-brand-primary`).
- 비용: 작음
- 같은 문제가 있는 다른 곳: B-10

### [C-13] 쓰이지 않는 CSS가 색 규칙을 들고 있음 [코드 확인]
- 위치: `.brand-icon`(styles.css:185, experience.css:81·645·912·1442, reference.css:36. TSX 사용 0), `.public-header`(12규칙, 0), `.login-page`·`.login-card`(14규칙, 0), `.chip.selected`·`.filter-chip`(experience.css:1425, 0), `.story-tabs`(experience.css:216, 0), `.subnavigation`(expansion.css:686, 0), `.plan-option`(expansion.css:1604, screens.css:577, 0), `.phase-strip`(expansion.css:219, 0), `.dashboard-task`(expansion.css:423, 0), `.rms-assistant-glyph`, `.lp-assistant-face`(0)
- 심각도: 낮음
- 무엇: 확인 명령은 `git grep -nwF -e "<클래스>" -- 'src/**/*.tsx'`(결과 0)이다. 이 규칙들이 `neutral-inverse`, `--text`를 바탕색으로 쓰는 선택 표시, hex 그라데이션 같은 '다른 색 규칙'을 들고 있어서 집계와 판단을 흐린다.
- 왜: README "다른 화면의 클래스를 재사용해 모양을 빌리지 않습니다"를 지키려면 남은 규칙 자체가 함정이 된다.
- 제안: 지운다(화면 비교 없이도 영향 없음. 단, 클래스 이름이 동적으로 조합되는지 한 번 더 grep으로 확인한다).
- 비용: 작음
- 같은 문제가 있는 다른 곳: 셸 `.nav-item.active` 7벌 중복(B-6)

---

## B. 라이트·다크 역할 일관성

### 역할 표

| 역할 | 라이트 | 다크 | 쓰는 곳 | 일치 |
|---|---|---|---|---|
| 주 행동(앱) | Montage Button solid primary → `--semantic-surface-brand-primary`(파랑) | 같음(파랑) | `components/ui/button.tsx` default, AuthPages 로그인·가입 | 일치 |
| 주 행동(공개, 헤더·히어로·하단 안내) | `.lp-button-dark` = `--semantic-surface-neutral-inverse`(검정 계열) | `--semantic-surface-brand-primary`(파랑) | `public-site.css:140-159`, `PublicPages.tsx:124,367,832` | **불일치**(테마 사이, 공개↔앱 사이) |
| 주 행동(공개, 파란 띠 안) | `.lp-close .lp-button-dark` = `--semantic-static-white` + `--atomic-blue-30` | 같음(같은 특이도에서 나중 규칙이 이김) | `public-site.css:1553-1559`, `PublicPages.tsx:704` | 테마 간 일치, 다른 공개 CTA와 불일치 |
| 보조 행동 | 앱: Button solid/outlined assistive. 공개: `.lp-button-light` = `--surface` + `--line` | Montage 자동 / `--surface`(coolNeutral-17) + `--line` | button.tsx, `public-site.css:161-168` | 대체로 일치(공개 쪽은 Montage가 아닌 손 CSS) |
| 선택 | `--selected-fill`(brand 8%) + `--selected-line` | brand 16% + `--selected-line` | `reference.css:516`, `assistant.css:59`, `week-strip.css:50`, `command-palette.css:85` | 테마 간 일치. **다른 선택 표시가 다섯 가지 더 있음**(B-4) |
| 호버 | 카드: `--hover-line`(line-brand-strong). 행: `--hover-fill`(surface-neutral-secondary) | 같음 | `tokens.css:51-52`, 호버 규칙 82개 중 hover-line 16, hover-fill 11, surface-muted 14, 글자를 파랑으로 28 | 테마 간 일치. 공개 화면 일부는 호버=선택(B-4) |
| 상태: 성공 | `--semantic-foreground-positive-primary` | Montage 자동 | StatusBadge green, toast success | 일치 |
| 상태: 경고 | `foreground-cautionary-primary` | 자동 | StatusBadge amber, toast warning | 일치 |
| 상태: 오류 | `foreground-negative-primary` | 자동 | StatusBadge red, `--danger` 21 | 일치 |
| 상태: 정보 | `foreground-brand-primary`(StatusBadge blue). 토스트는 `foreground-brand-inverse` | 자동 | `common.tsx:72`, `montage.css:245` | 테마 간 일치, **주 행동·선택과 같은 색**(D-1) |
| 미팅(브랜드) | `--semantic-foreground-brand-primary` 채움 + 흰 글자 | 자동 + 흰 글자 | `PlanningPage.tsx:54-66`, `week-strip.css:88` | 일치. 다크에서 밝은 전경색 위 흰 글자 [추측] — B-8, 다크 캡처로 기각 |
| 마감(주황) | `foreground-cautionary-primary` | 자동 | 같음, `week-strip.css:92` | 일치. 경고 상태와 같은 색(D-3) |
| 단계 목표(보라) | `foreground-accent-violet` | 자동 | `PlanningPage.tsx:57` | 일치(보라는 여기서만 씀) |
| 주요 목표(초록) | `foreground-positive-primary` | 자동 | `PlanningPage.tsx:58` | 일치. 완료·교수 확인과 같은 색(D-2) |
| 면: 바탕 | `--canvas` = background-neutral-secondary | coolNeutral-15 | tokens.css:21,75 | 의도된 차이(문서화됨) |
| 면: 작업 면 | `--surface` = background-neutral-primary | coolNeutral-17 | tokens.css:22,76 | 의도된 차이 |
| 면: 떠 있는 면 | `--surface-raised` = surface-elevated-primary | coolNeutral-22 | tokens.css:26,78 / 쓰는 곳 3 | 일치. 다만 SegmentedControl 다크 선택 면은 coolNeutral-30으로 4단계째(B-10) |
| 반전(inverse) | 토스트 반투명 반전 면 + 흰 글자, 공개 CTA, 도우미 데모 아이콘 | 반전 면 = 밝은 색 [추측] | `montage.css:214,258`, `public-site.css:141,825`, `experience.css:649,1443`(죽은 코드) | **위험**(B-2) |

### `[data-theme="dark"]` 규칙 하나씩 판정

| 파일:줄 | 무엇을 바꾸나 | 판정 |
|---|---|---|
| styles.css:43 | color-scheme | 문제 없음 |
| tokens.css:74 | 면 층위·선택 채움 농도 | 문서화된 예외, 문제 없음 |
| montage.css:55,58 | SegmentedControl 선택 면 → coolNeutral-30 | 면 단계 하나 추가(B-10) |
| brand.css:42,45 | 로고 이미지 교체 | 브랜드 자산, 문제 없음 |
| public-site.css:153,157 | 주 CTA 검정 → 파랑 | **같은 뜻인데 색이 바뀜**(B-1) |
| public-site.css:1044 | 단계 레일 면: surface-muted → surface + 테두리 | 층위 보정, 문제 없음. 다만 라이트·다크가 다른 토큰을 씀 |
| public-site.css:1550 | 푸터 그라데이션 | 브랜드 그림, 허용 |
| public-site.css:1561 | 하단 띠 로고 색 atomic-blue-50 | 토큰 규칙 경계(C-12) |
| public-site.css:2227 | 푸터 하단선 | 브랜드 그림, 허용 |
| research-home.css:978 | 도우미 심볼 그림자 없앰 | 문제 없음 |

### [B-1] 주 행동 색이 공개 화면 라이트(검정)·다크(파랑)·앱(파랑)에서 서로 다름 [코드 확인]
- 위치: 소개·기능·안내 화면 → 가입·로그인 · 전체 너비 · 라이트 / `src/pages/public-site.css:140-159`, `:1553-1559`, `src/pages/PublicPages.tsx:124,367,704,832`, `src/pages/AuthPages.tsx:103`
- 심각도: 높음
- 반박 검증: 확인. 1440px 라이트·다크 캡처(shots/landing-1440-*.png)에서 머리·히어로 ‘시작하기’가 라이트 검정, 다크 파랑.
- 무엇: 확인을 요청받은 예시가 맞다. `.lp-button-dark`는 라이트에서 `--semantic-surface-neutral-inverse` 바탕에 `--semantic-foreground-neutral-inverse` 글자이고, 153행 `[data-theme="dark"] .lp-button-dark`에서 `--semantic-surface-brand-primary`와 흰 글자로 바뀐다. 파란 띠 안의 CTA(`.lp-close`)는 두 테마 모두 흰 바탕에 파란 글자다. 반면 라이트 사용자가 '시작하기'(검정)를 누르고 넘어간 가입·로그인 화면의 주 버튼은 Montage solid primary(파랑)다. 결국 같은 '시작하기'가 세 가지 색으로 보인다. 공개 CTA는 Montage Button도 아니다(`<Link className="lp-button …">`, 계획 4단계 대상).
- 왜: "주행동 1개만 solid primary"(통일 계획 4단계 Figma 위계)를 어긴다. 라이트 사용자는 공개 화면에서는 검정을, 앱에서는 파랑을 주 행동으로 배우게 된다. 다크 규칙의 주석("흰 버튼은 가장 밝은 면이 되어 위계를 깸")은 라이트에서 검정 버튼이 가장 진한 면이 되는 것과 같은 논리인데 라이트만 그대로 뒀다.
- 제안: 아래 대안 A를 권한다.
- 비용: 작음(A) / 작음(B)
- 같은 문제가 있는 다른 곳: `.lp-chat-composer > svg:last-child`(public-site.css:823-829, 데모 보내기 아이콘이 반전 면), 죽은 `.brand-icon` 반전 면(C-13)

**주 행동 색 통일 대안**

| | A. 공개 CTA도 브랜드 파랑(Montage Button solid primary) | B. 공개 CTA는 '반전 중립'을 별도 역할로 정하고 두 테마에서 유지 |
|---|---|---|
| 구현 | `<Button asChild size="lg">` / 헤더는 `size="default"`(40). `.lp-button-dark`와 다크 규칙 153·157 삭제. 파란 띠 안 CTA만 '파란 바탕 위 흰 버튼' 예외 하나로 둠(`--semantic-static-white` 바탕 + `--semantic-foreground-brand-primary` 글자, atomic 제거) | 153·157 삭제 → 다크에서는 흰 버튼(neutral-inverse). README에 "공개 화면 CTA = 반전 중립, 앱 주 행동 = 브랜드"라는 두 역할을 적음 |
| 좋은 점 | 공개 → 가입 → 앱에서 주 행동 색이 하나다. 손 CSS 버튼과 다크 예외가 없어지고 Montage 높이·호버·포커스·누름 상태를 그대로 쓴다. 계획 4단계(`.lp-button` → Button)를 끝낸다 | 지금 라이트 소개 화면의 흑백 인상을 지킨다. 바뀌는 곳은 다크 공개 화면뿐이다 |
| 나쁜 점 | 히어로의 파란 Cloud Shader 하늘 위에서 파란 버튼이 덜 튈 수 있다 [추측, 사용자 시각 확인 필요]. 소개 화면 인상이 바뀐다 | 주 행동 색이 여전히 두 개다. 가입·로그인 화면(Montage primary 파랑)으로 넘어가면 색이 바뀐다. 다크에서 흰 버튼이 화면에서 가장 밝은 면이 되어 지금 주석이 막으려던 문제가 다시 생긴다. Montage Button에는 inverse 색이 없어 손 CSS가 계속 남는다 |

### [B-2] 토스트가 두 테마 모두 '반전 면 + 흰 글자'라 다크에서 밝은 면 위 흰 글자가 될 수 있음 [추측]
- 위치: 모든 화면의 알림 · 전체 · 다크 / `src/design/montage.css:209-225,256-263`
- 심각도: 높음
- 반박 검증: 확인(막힘으로 올림). 데모 다크에서 할 일 완료 알림의 계산값: 바탕 rgba(255,255,255,0.52)+blur, 글자 rgb(255,255,255). 회색 면 위 흰 글자(shots/toast-1280-dark.png).
- 무엇: 바탕은 `rgba(var(--semantic-surface-neutral-inverse-rgb), var(--opacity-52))`, 글자는 `--semantic-static-white`, 닫기 버튼도 반전 88% 위 흰 글자다. 다크 테마에서 neutral-inverse는 보통 밝은 색이다(Montage 값은 확인하지 못함). 통일 계획 4단계에도 "Montage Toast는 … 다크 모드에서 흰 바탕에 흰 글자가 되는 문제가 있다"고 적혀 있는데, 같은 구성을 그대로 옮겼다. 정보 아이콘과 동작 버튼은 `--semantic-foreground-brand-inverse`다.
- 왜: '되돌리기' 알림(할 일 완료 6초)을 놓치면 실수를 되돌릴 방법을 모르는 학생이 생긴다. CHANGELOG "알림이 다크 테마에서도 다크로 표시됨"과도 반대다.
- 제안: 다크에서는 `[data-theme="dark"] .margin-toast`로 바탕을 `--surface-raised`(coolNeutral-22), 글자를 `--semantic-foreground-neutral-primary`로 바꾸거나, 테마와 상관없이 늘 어두운 고정 면(`--semantic-static-black` 계열 + `--opacity-*`)으로 정한다. 렌더링해서 확인해야 한다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: `.lp-chat-composer > svg`(public-site.css:825-826), 반전 면 데모 아이콘

### [B-3] '현재 단계' 번호 글자가 `--surface`라서 다크에서 흰색 → 거의 검정으로 바뀜 [코드 확인]
- 위치: 계획·로드맵 단계 카드 · 전체 · 다크 / `src/pages/screens.css:70-74`
- 심각도: 보통
- 반박 검증: 미재현. 데모에서 기본 단계를 만든 직후에는 is-current 카드가 없어 다크 번호가 rgba(194,196,200,.88) 글자/어두운 면이었음. 현재 단계를 지정한 상태는 확인 못 함 → 코드상 위험으로 유지(보통).
- 무엇: `.phase-card.is-current .phase-number { color: var(--surface); background: var(--brand) }`. tokens.css:76에서 다크 `--surface` = `--atomic-coolNeutral-17`(매우 어두움)이므로 라이트는 파랑 위 흰 숫자, 다크는 파랑 위 어두운 숫자가 된다. 같은 뜻인 주간 띠 '오늘'(`week-strip.css:74-76`)은 `--semantic-surface-brand-primary` + `--semantic-static-white`다.
- 왜: 같은 '현재/오늘' 표시가 테마와 화면에 따라 글자색이 다르다. 면 토큰을 글자색으로 쓰는 역할 오용이다(D-7).
- 제안: `background: var(--semantic-surface-brand-primary); color: var(--semantic-static-white)`. 가능하면 Montage `ContentBadge`나 `PushBadge`로 바꾼다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: `src/pages/writing.css:354-357`(B-5), `src/pages/student/student.css:501-505`(`.student-check-indicator.checked` 회색 위 `--surface` 체크), `experience.css:1468-1474`(접힌 사이드바 툴팁 `--text` 바탕 + `--surface` 글자, Montage Tooltip과 다른 손 툴팁)

### [B-4] '선택' 표시가 여섯 가지 꼴로 갈라짐 [코드 확인]
- 위치: 앱·공개 전체 · 두 테마 / 아래 목록
- 심각도: 높음
- 반박 검증: 확인(코드). 화면에서도 사이드바 선택(파란 면+테두리), 보기 전환 선택(밝은 칩), 주간 띠 오늘(파란 칸+파란 원)이 서로 다름(shots/home-1440-dark.png).
- 무엇:
  1. 브랜드 옅은 면 + 얇은 브랜드 선(`--selected-fill`/`--selected-line`): 사이드바 `reference.css:516`, 대화 목록 `assistant.css:59`, 주간 띠 `week-strip.css:50`, ⌘K `command-palette.css:85`
  2. `--brand-soft` + `--brand` 테두리: 교수 결과 `reviews.css:760`, 자료 고르기 `assistant.css:647`, 역할 고르기 `experience.css:568`, 폴더 `expansion.css:1831`
  3. 흰 면 + 그림자(세그먼트 꼴): 푸터 테마 `footer-controls.css:37`, 기능 고르기 `public-site.css:936/1037`(다크는 `--surface-raised`), 데모 탭 `public-site.css:302`, Montage SegmentedControl
  4. 반전(`--text` 바탕 + `--surface` 글자): 편집 도구 막대 `writing.css:354`, 죽은 `.chip.selected`
  5. 회색 면(`--surface-muted`): 설정 메뉴 `experience.css:1003`, 검토 항목 목록 `reviews.css:455`(번호만 파랑)
  6. 초록: 시간 조율 후보 `screens.css:288`(`color-mix(--success)`), 공개 예시 `public-site.css:496`

  공개 화면 `lp-tour-index`(public-site.css:2118)와 `lp-capability:hover`(1230), 내비 패널(public-navigation.css:103)은 호버와 선택이 같은 `--brand-soft`다.
- 왜: migration 2-1의 "호버는 중립, 선택은 브랜드"를 화면 대부분이 따르지 않는다. 같은 화면에서 '고른 것'을 알아보는 단서가 컨트롤마다 다르다. 교수 결과(2번)와 사이드바(1번)는 모두 파랑이지만 농도와 테두리가 다르다.
- 제안: 선택 규칙을 셋으로 줄인다. ① 목록·카드 선택 = `--selected-fill` + `--selected-line`(1번). ② 같은 층의 2~5개 중 하나 = Montage `SegmentedControl`. ③ 켜짐/꺼짐 도구 = Montage `IconButton` + `aria-pressed` 상태 색(Montage 기본). 2·4·5·6번을 여기에 맞추고, 공개 화면 호버는 `--hover-fill`로 바꾼다.
- 비용: 중간
- 같은 문제가 있는 다른 곳: B-6

### [B-5] 편집 도구 막대 '켜짐'이 반전 면이라 다크에서 가장 밝은 흰 칸이 됨 [코드 확인]
- 위치: 글쓰기 하단 도구 막대 · 전체 · 다크 / `src/pages/writing.css:354-357`, `src/components/experience.tsx:244`(`motion.button`)
- 심각도: 보통
- 무엇: `background: var(--text); color: var(--surface)`이다. 라이트에서는 검정 칸에 흰 아이콘, 다크에서는 흰 칸(`--text`가 밝음)에 어두운 아이콘이다. 공개 CTA 다크 규칙이 '흰 면은 위계를 깬다'며 피한 꼴을 앱에서 쓰고 있다.
- 왜: 라이트·다크에서 같은 '켜짐' 의미의 대비 방향이 뒤집힌다. 다른 앱 선택 표시(파랑)와도 다르다.
- 제안: DockItem을 Montage `IconButton variant="normal"`로 바꾸고 켜짐은 `--selected-fill` + `--semantic-foreground-brand-primary`로 표시한다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: B-3 목록

### [B-6] '지금 있는 곳(현재 위치)' 표시가 내비게이션마다 다름, 사이드바 규칙 7벌 중복 [코드 확인]
- 위치: 사이드바 · 설정 메뉴 · 공개 헤더 · 휴대폰 메뉴 / `src/styles.css:275`, `src/expansion.css:26`, `src/experience.css:722,728,1692`, `src/reference.css:102,109,516,567`, `src/experience.css:1003`, `src/components/marketing/public-navigation.css:35`
- 심각도: 보통
- 무엇: 사이드바 `.nav-item.active`가 7곳에서 정의된다. 불러오는 순서와 특이도로 따지면 최종은 reference.css:516(선택 채움 + 브랜드 글자 + 안쪽 선)이고, 아이콘은 reference.css:109의 `color: var(--text)`가 experience.css:728의 브랜드 색을 덮는다. 그래서 글자는 파랑인데 아이콘은 검정일 가능성이 있다 [추측, 렌더 미확인]. 설정 메뉴(`aria-current`)는 회색 면 + 검정 글자, 공개 헤더는 `color: var(--primary)` 글자만, 휴대폰 메뉴(1692)는 브랜드 글자 + 회색 면이다.
- 왜: 같은 '현재 페이지' 뜻이 세 가지 색 규칙으로 보인다. 중복 규칙 때문에 다음 수정이 어디서 이기는지 알기 어렵다.
- 제안: 현재 위치 = `--selected-fill` + `--semantic-foreground-brand-primary`(글자·아이콘 함께)로 하나로 정한다. 사이드바 규칙은 reference.css 한 벌만 남긴다. 설정 메뉴도 같은 규칙을 쓴다.
- 비용: 중간
- 같은 문제가 있는 다른 곳: B-4

### [B-7] `--brand`(전경 토큰)를 바탕으로 쓰는 곳 13개와 `--primary`(면 토큰)를 바탕으로 쓰는 곳이 섞여 있음 [코드 확인 / 값 차이는 추측]
- 위치: `background: var(--brand)` — expansion.css:544, experience.css:270·1420, reviews.css:85, screens.css:72, material-upload-field.css:231, student.css:628·970, reference.css:309·352, styles.css:435·834·1471 / `background: var(--primary)` — expansion 220·1526, experience 808, research-home 221·418, screens 507, styles 134·190, public-navigation 252, public-site 101
- 심각도: 낮음
- 무엇: `--brand` = `--semantic-foreground-brand-primary`, `--primary` = `--semantic-surface-brand-primary`다. 다크에서 두 값이 다르면(Montage는 보통 다크 전경 브랜드색을 더 밝게 둔다) 같은 '파란 점·막대'가 화면마다 미세하게 다른 파랑으로 보인다 [추측].
- 왜: 역할 토큰을 쓰는 목적(테마마다 맞는 값)이 사라진다.
- 제안: 채움은 `--semantic-surface-brand-primary`, 글자·아이콘은 `--semantic-foreground-brand-primary`로 나눈다. 별칭 `--brand`, `--primary`를 지우면 이런 혼용이 저절로 드러난다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: D-7

### [B-8] 큰 달력 일정 채움이 전경 토큰 + 흰 글자라 다크에서 밝은 채움 위 흰 글자가 될 수 있음 [추측]
- 위치: 계획·일정 큰 달력 · 전체 · 다크 / `src/pages/PlanningPage.tsx:54-66`
- 심각도: 보통
- 반박 검증: 기각. 데모 다크 큰 달력에서 할 일 마감은 주황 막대+갈색 채움+흰 글자, 미팅은 파란 점+흰 글자로 읽힘(검토 중 캡처, 저장소에는 넣지 않음). 미팅 색 토큰이 두 갈래인 점만 낮음으로 남김.
- 무엇: `EVENT_TONE`은 `--semantic-foreground-{brand,cautionary,accent-violet,positive}-primary`를 채움색으로, `--semantic-static-white`를 글자색으로 쓴다. 다크 전경색은 밝은 단계라서 주황·초록 막대 위 흰 글자가 흐려질 수 있다(값 미확인). FullCalendar 기본 일정색은 `--semantic-surface-brand-primary`(montage.css:164)로 면 토큰이라 미팅 색이 두 토큰 사이에서 갈린다.
- 왜: 정보 유형 색 규칙은 맞지만 채움에 쓰기에는 맞지 않는 토큰이다.
- 제안: 채움은 `--semantic-surface-*`나 `rgba(var(--semantic-foreground-*-rgb), var(--opacity-16))` 옅은 채움에 전경색 글자를 쓴다. 미팅은 FullCalendar 기본값과 같은 토큰으로 맞춘다. 렌더 확인이 필요하다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 주간 띠 점(`week-strip.css:88,92`)은 점이라 문제가 작다

### [B-9] 공개 화면 단계 레일이 라이트·다크에서 다른 층 토큰을 씀 [코드 확인]
- 위치: 소개 '이렇게 사용해요' · 1200px 이상 · 두 테마 / `src/pages/public-site.css:1021-1025, 1044-1047, 1037`
- 심각도: 낮음
- 무엇: 라이트는 `--surface-muted`(반투명 회색), 다크는 `--surface` + `--line` 테두리, 선택 항목은 `--surface-raised`다. 떠 있는 면(`--surface-raised`)을 '선택'의 뜻으로 쓴다.
- 왜: 면 층위 3단계(바탕·작업 면·떠 있는 면)의 뜻과 선택 표시가 섞인다.
- 제안: 레일 = `--canvas`(두 테마 공통), 선택 = SegmentedControl 꼴(B-4 ②)로 정리하고 다크 규칙을 지운다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: B-10

### [B-10] 다크 SegmentedControl 선택 면이 면 층위 밖 네 번째 단계(coolNeutral-30) [코드 확인]
- 위치: 모든 보기 전환 · 전체 · 다크 / `src/design/montage.css:54-62`
- 심각도: 낮음
- 무엇: 바탕 15, 작업 면 17, 떠 있는 면 22에 더해 선택 면 30을 새로 쓴다. 주석은 Montage 기본 선택 면 `#212225`가 트랙보다 어두워 보인다고 설명한다.
- 왜: migration 2-1 "이 선택은 tokens.css의 [data-theme=dark] 블록 한 곳에만"과 어긋난다.
- 제안: tokens.css에 `--surface-selected`(다크 coolNeutral-30, 라이트 Montage 기본)처럼 한 줄을 두고 montage.css에서는 그 별칭만 쓰거나, `--surface-raised`(22)로 충분한지 사용자가 시각으로 확인한다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: C-12

---

## D. 색 사용과 위계

### 색 역할 표 (지금 상태)

| 토큰(별칭) | 지금 뜻 | 쓰는 곳(예) | 겹침 |
|---|---|---|---|
| `foreground-brand-primary` (`--brand` 159) | 링크·호버 글자(28개 규칙), 선택 글자, 현재 단계, 미팅 유형, '정보' 배지, '진행 중'·'공유 중'·'현재 단계' 배지, 아이콘 강조, 완료 체크(`research-home.css:228,457`), 바탕 채움(13곳) | research-home, reviews, reference, common.tsx:72 | **9가지 이상 뜻** |
| `surface-brand-primary` (`--primary` 34) | 주 버튼, 오늘 원, 스위치 켜짐, 공개 내비 밑줄·글자, 큰 달력 일정 기본 | button.tsx, week-strip:75, public-navigation:39-135 | 공개 내비에서는 글자색으로 오용 |
| `surface-brand-subtle` (`--brand-soft` 51) | 선택 바탕, 공개 호버 바탕, 아이콘 우물, 완료 체크 바탕, 도우미 카드 바탕 | research-home:230,459,515,747,846,1221 | 선택 = 호버 = 장식 = 완료 |
| `--selected-line` (line-brand-primary, 11) | 선택 테두리 + 다음 미팅 카드 테두리, 완료 단계, 아이콘 우물, 빠른 기록 | research-home:229,261,458,513,745,844,886,1222 | 이름은 '선택'인데 대부분 '강조'로 씀 |
| `--hover-line` (line-brand-strong, 16) | 누를 수 있는 카드 호버 | 10개 파일 | 호버 테두리도 파랑이라 선택과 비슷하게 보임 [추측] |
| `foreground-positive-primary` (`--success` 19) | 할 일 완료, 미팅 기록됨, 일정 확정, **교수 '수정 내용 확인'**, 단계 완료, 시간 후보 선택, **주요 목표 유형** | helpers.tsx:105-111, TasksPage:178, PlanningPage:58,337,936,987, screens:288 | **완료 = 교수 결과 = 일정 유형**(D-2) |
| `foreground-cautionary-primary` (`--warning` 14) | **교수 '추가 수정 필요'**, 미팅 보류, 공유 중단, 미확정 전사, 응답 대기, **마감 유형** | helpers.tsx:20,107, FeedbackPage:157, SavedTranscript:173, PlanningPage:56 | 경고 = 정보 유형(D-3) |
| `foreground-negative-primary` (`--danger` 21) | 오류, 녹음 중, 삭제 | RecordingPanel:413, 오류 문구 | 녹음 중(정상 동작)이 오류색 |
| `foreground-accent-violet` | 단계 목표 유형 | PlanningPage:57 | 없음 |
| `surface-accent-cyan` | 공개 화면 장식 | public-site:1154-1168 | 없음(공개만) |
| `surface-neutral-inverse` | 공개 주 CTA(라이트), 토스트 바탕, 데모 아이콘, 죽은 `.brand-icon` | public-site:141,826, montage.css:215 | 주 행동 = 알림 바탕 |
| `--text`를 바탕으로 | 도구 막대 켜짐, 접힌 메뉴 툴팁, 죽은 칩 선택 | writing:355, experience:1473 | 선택 = 툴팁 |
| `--text-secondary` (379) | 본문 대부분, 설명, 비활성 링크, 완료 체크(meetings) | 전체 | 기본 글자보다 3배 많음(D-5) |

### 화면별 강조 토큰 수 (accent·status·brand 계열에서 서로 다른 토큰 수 / 계열)

명령: `for f in $(git ls-files 'src/*.css' 'src/**/*.css'); do grep -oE "var\(--(semantic-[a-z]+-(brand|positive|cautionary|negative|accent)[a-z-]*|brand[a-z-]*|primary[a-z-]*|success|warning|danger[a-z-]*|tone-[a-z]+|selected-[a-z]+|hover-line|atomic-[a-zA-Z0-9-]+)" $f | sort -u | wc -l; done`

| 파일(화면) | 토큰 수 | 계열 |
|---|---|---|
| pages/public-site.css (소개) | 13 | brand·positive·accent-cyan·atomic |
| pages/research-home.css (연구 홈) | 11 | brand·positive·cautionary·tone-gray |
| expansion.css (셸·여러 화면) | 11 | brand·positive·negative |
| pages/assistant.css (연구 도우미) | 9 | brand·cautionary·negative |
| reference.css (셸) | 9 | brand·positive·cautionary·negative |
| styles.css (공통) | 9 | 4계열 전부 |
| pages/reviews/reviews.css (교수 검토) | 7 | 4계열 전부 |
| pages/screens.css (계획·설정) | 7 | brand·positive·negative |
| components/home/week-strip.css | 7 | brand·cautionary |
| pages/student/student.css (할 일·자료·미팅) | 5 | 4계열 전부 |
| pages/writing.css (글쓰기) | 5 | brand·positive·negative |
| experience.css | 5 | brand·positive |

TSX의 StatusBadge tone(파랑·초록·주황·빨강)은 이 표에 들어 있지 않다. 연구 홈은 CSS 11개 토큰에 배지 색까지 더해져서 가장 많은 강조색이 한 화면에 모인다 [코드 확인, 화면 수는 추측].

### 글자 위계 (공개 화면·브랜드 CSS 제외, 앱 CSS)

- 쓰는 크기 단계 16개 전부: caption1 188 · label2 153 · label1 108 · caption2 93 · body2 39 · body1 20 · heading1 19 · title3 18 · headline2 16 · headline1 16 · title2 13 · heading2 11 · title1 6 · display2 5 · display3 4 · display1 4 (합 713)
- caption·label 네 단계가 **76%**(542/713), 본문 body1·body2는 **8%**(59).
- 크기×굵기 조합 44개, 크기×굵기×색 조합 **102개**. 굵기는 400/500/600/700 숫자로 직접 쓰고 `--typography-*-weight-*` 토큰은 2곳뿐이다.
- 글자색 선언: `--text-secondary` 375 · `--text` 109 · `--brand` 109 · `--text-tertiary` 79.
- 명령: 위 Python 파서(`font-size: var(--typography-X)`와 같은 규칙의 `font-weight`·`color`를 셈)

### [D-1] 파랑 하나가 주 행동·선택·호버·링크·정보·진행 중·미팅·완료·장식을 모두 맡음 [코드 확인]
- 위치: 연구 홈 · 전체 · 두 테마 / `src/pages/research-home.css:228-231,261,457-460,513-516,745-748,844-846,1221-1222`, `src/components/common.tsx:72`
- 심각도: 높음
- 반박 검증: 확인(코드·화면). 결정 질문 Q3로 올림.
- 무엇: 연구 홈 한 화면에서 다음이 모두 브랜드 파랑 계열이다: 주 버튼(Montage primary), 다음 미팅 카드 테두리(`--selected-line`), 완료된 단계 번호와 준비 완료 체크(`--brand-soft` + `--brand`), 아이콘 우물, 도우미 카드 바탕, 빠른 기록 카드, 링크 호버(`!important` 파랑), 주간 띠 오늘·선택·미팅 점, '진행 중' 배지.
- 왜: 사용자(학생)가 '파란 것 = 누를 것/고른 것'을 배울 수 없다. 특히 '완료'까지 파랑이라서 초록 완료 배지(할 일 화면)와 뜻이 갈린다(D-4).
- 제안: 파랑은 ① 주 행동, ② 선택·현재 위치, ③ 링크 글자, ④ 미팅 유형 네 가지에만 쓴다. 장식 카드(도우미·빠른 기록·아이콘 우물)는 `--semantic-surface-neutral-secondary` + `--semantic-line-neutral-secondary` 중립으로 바꾼다. 다음 미팅 카드는 테두리를 중립으로 두고 날짜 칸만 브랜드로. 완료는 D-4 규칙을 따른다.
- 비용: 중간
- 같은 문제가 있는 다른 곳: 공개 화면 `--brand-soft` 호버(B-4)

### [D-2] 초록이 '작업 완료'·'교수 수정 내용 확인'·'일정 확정'·'주요 목표'를 함께 뜻함 [코드 확인]
- 위치: 교수 검토·할 일·계획 · 전체 · 두 테마 / `src/pages/reviews/helpers.tsx:102-115`(`confirmed` → green), `src/pages/student/TasksPage.tsx:178-185`(`done` → green), `src/pages/student/MeetingsPage.tsx:237-245`(`recorded` → green), `src/pages/PlanningPage.tsx:58`(주요 목표 = positive), `:337,936,987`
- 심각도: 높음
- 반박 검증: 확인(코드). AGENTS.md ‘합치지 않는다’와 직접 충돌해 높음 유지. 결정 질문 Q3.
- 무엇: 같은 ContentBadge accent `--semantic-foreground-positive-primary`가 학생의 작업 완료, 교수의 '수정 내용 확인', 일정 확정, 미팅 기록됨, 큰 달력의 '주요 목표' 일정 막대에 모두 쓰인다.
- 왜: AGENTS.md 제품 불변 조건 "작업 완료·학생 반영 기록·교수 결과·댓글 해결·읽음을 서로 합치지 않는다"를 색에서 합친다. 교수 결과는 다른 기록과 구분돼야 한다. 문구는 다르지만 같은 초록 배지라 한눈에 같은 상태처럼 읽힌다. 주요 목표(앞으로 할 일)가 '완료' 색이라서 달력에서 이미 끝난 일처럼 보일 수 있다 [추측].
- 제안: 초록은 '학생 작업 완료·확정' 하나로 정한다. 교수 결과는 색 대신 Montage `ContentBadge variant="outlined"` + 아이콘 + 고정 문구로 구분한다('수정 내용 확인' 초록 테두리, '추가 수정 필요' 주황 테두리). 주요 목표 유형색은 `--semantic-foreground-accent-*` 계열 중 상태에 쓰지 않는 색(예: accent-violet은 단계 목표가 쓰므로 accent-cyan 등)으로 옮긴다. 정확한 Montage accent 목록은 패키지에서 확인해야 한다.
- 비용: 중간
- 같은 문제가 있는 다른 곳: D-3

### [D-3] 주황이 '마감 유형'과 '추가 수정 필요·보류·공유 중단·미확정' 경고를 함께 뜻함 [코드 확인]
- 위치: `src/pages/PlanningPage.tsx:56`, `src/components/home/week-strip.css:92`, `src/pages/reviews/helpers.tsx:20,107`, `src/components/SavedTranscript.tsx:173`
- 심각도: 보통
- 무엇: 주간 띠·큰 달력의 '할 일 마감' 점과 막대는 cautionary다. 같은 색이 교수 '추가 수정 필요', 검토 '공유 중단', 미팅 '보류', 전사 '미확정'에도 쓰인다.
- 왜: 마감이 모두 경고처럼 보여서, 아직 여유 있는 마감도 문제가 있는 것처럼 느껴진다 [추측].
- 제안: 정보 유형(미팅·마감·단계 목표·주요 목표)은 점이나 막대 색에만 쓰고, 상태 배지에는 쓰지 않는 색 묶음을 따로 정한다. 마감이 지났을 때만 cautionary/negative 상태를 함께 표시한다.
- 비용: 중간
- 같은 문제가 있는 다른 곳: D-2

### [D-4] '완료'가 화면마다 세 가지 모양 [코드 확인]
- 위치: 연구 홈 `src/pages/research-home.css:228-231,457-460`(브랜드 옅은 면 + 파랑), 미팅 연결 할 일 `src/pages/student/student.css:501-505`(회색 채움 + `--surface` 체크), 할 일·계획 배지(초록 ContentBadge), 할 일 체크(Montage Checkbox 기본)
- 심각도: 보통
- 무엇: 같은 할 일 완료가 홈에서는 파랑, 미팅 상세에서는 회색, 할 일 화면에서는 초록으로 보인다.
- 왜: 같은 기록의 같은 상태를 화면마다 다시 배워야 한다.
- 제안: 완료 체크 = Montage `Checkbox` 체크 상태(앱 전체), 완료 라벨 = `StatusBadge tone="green"` 하나로 정한다. 읽기 전용 표시도 `Checkbox disabled checked`나 Montage 아이콘 + positive 전경색으로 맞춘다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: D-1

### [D-5] 글자 위계가 작은 회색 글자 쪽으로 쏠림 [코드 확인 / 체감은 추측]
- 위치: 앱 CSS 전체
- 심각도: 보통
- 무엇: 크기 선언 76%가 caption·label(11~14px대 [추측: Montage 값 미확인])이고 본문 단계는 8%다. 글자색은 보조(`--text-secondary`)가 기본(`--text`)의 3.4배다. 크기×굵기×색 조합이 102개다.
- 왜: 학생이 긴 연구 기록을 읽는 화면에서 본문이 작고 흐리게 읽힐 수 있다. 조합이 너무 많아 '제목/본문/보조/메타' 4단계가 코드에서 드러나지 않는다.
- 제안: 앱 글자 단계를 6개로 고정한다. 화면 제목 `title3`·700 / 구역 제목 `headline2`·600 / 카드 제목 `body1`·600 / 본문 `body2`·400 `neutral-primary` / 보조 `label2`·400 `neutral-secondary` / 메타 `caption1`·400 `neutral-tertiary`. 굵기는 `--typography-*-weight-*` 토큰으로 쓴다. 목록 행 제목 등 읽을 글자에 쓰인 `--text-secondary`를 `--semantic-foreground-neutral-primary`로 올린다.
- 비용: 큼
- 같은 문제가 있는 다른 곳: 공개 화면 데모 10px(C-2)

### [D-6] 녹음 중을 오류색(빨강)으로 표시 [코드 확인]
- 위치: 미팅 녹음 패널 · 전체 · 두 테마 / `src/components/RecordingPanel.tsx:413`
- 심각도: 낮음
- 무엇: `tone={state === "recording" ? "red" : "neutral"}`이다. 빨강은 다른 곳에서 오류·삭제를 뜻한다.
- 왜: 녹음 중이라는 정상 동작이 오류처럼 보일 수 있다. 녹음 관례(빨간 점)와는 맞기 때문에 '빨강 = 오류'와 '빨강 = 녹음 중'이 겹친다.
- 제안: 관례를 유지하되 배지 대신 빨간 점 아이콘 + '녹음 중' 중립 배지처럼 모양으로 구분하거나, README 색 규칙에 '녹음 중 = negative 예외'로 적는다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: 없음

### [D-7] 별칭 이름이 역할을 가려서 면·전경 토큰이 뒤바뀌어 쓰임 [코드 확인]
- 위치: `color: var(--primary)` 8곳(public-navigation.css:39,79,115,135, subscription-plans.css:111, public-site.css:2121,2198,2220), `color: var(--surface)` 6곳(experience.css:1428,1474, screens.css:71, student.css:503, writing.css:356, reference.css:41), `background: var(--brand)` 13곳(B-7), `color: var(--line-strong)` 4곳(marketing-effects.css:34, research-home.css:545, writing.css:146, reference.css:184)
- 심각도: 보통
- 무엇: 면 토큰을 글자에, 전경 토큰을 면에, 선 토큰을 글자에 쓴다. `--surface`를 글자로 쓴 곳은 다크에서 실제로 어두운 글자가 된다(B-3).
- 왜: Montage 시맨틱 토큰은 역할(foreground/surface/line)마다 테마별 대비를 맞춘다. 역할을 바꿔 쓰면 그 보장이 사라진다.
- 제안: 별칭을 지우고 `--semantic-foreground-*`, `--semantic-surface-*`, `--semantic-line-*`을 직접 쓴다(C-9). `color: var(--line-strong)`(아이콘·구분자)은 `--semantic-foreground-neutral-quaternary`로 바꾼다.
- 비용: 작음
- 같은 문제가 있는 다른 곳: B-3, B-5, B-7

---

## 권장 색 규칙 (1쪽)

**원칙: 색 하나에 뜻 하나. 같은 뜻은 공개 화면·앱·라이트·다크 어디서나 같은 토큰.**

1. **역할 토큰만 쓴다.** 글자·아이콘은 `--semantic-foreground-*`, 채움은 `--semantic-surface-*`, 선은 `--semantic-line-*`. 별칭과 atomic은 tokens.css의 다크 면 층위(15·17·22)에서만 쓴다. hex는 Cloud Shader·마스코트·푸터 칸 글자 그림·PDF 출력에서만.
2. **브랜드 파랑(4가지 뜻만).**
   - 주 행동: Montage `Button` solid primary. 한 화면에 하나. 공개 화면도 같다(파란 띠 위에서만 흰 버튼 예외 하나).
   - 선택·현재 위치: `--selected-fill` + `--semantic-foreground-brand-primary`(+ 필요하면 `--selected-line`). 보기 전환은 `SegmentedControl`.
   - 링크 글자: `TextButton color="primary"`.
   - 미팅 유형: 점·막대.
   - 그 밖의 카드 강조·장식·아이콘 우물·완료에는 쓰지 않는다.
3. **호버는 중립.** 행 = `--hover-fill`, 카드 = `--hover-line`. 호버가 선택과 같은 색이면 안 된다.
4. **상태(배지·알림 아이콘)는 Montage ContentBadge accent.**
   - 초록 `positive` = 학생 작업 완료·확정
   - 주황 `cautionary` = 주의가 필요한 진행 상태(보류·공유 중단·미확정)
   - 빨강 `negative` = 오류·삭제(녹음 중은 문서화된 예외)
   - 회색 `neutral` = 시작 전·취소
   - '정보'는 별도 색 없이 중립 배지 + 아이콘
5. **교수 결과는 상태색과 섞지 않는다.** '수정 내용 확인'과 '추가 수정 필요'는 outlined ContentBadge + 고정 아이콘 + 문구로 표시하고, 학생 작업 완료(초록 solid)와 모양이 달라야 한다.
6. **정보 유형 색(달력·주간 띠 점과 막대에만).** 미팅 = 브랜드, 마감 = 주황(지났을 때만 상태 배지 추가), 단계 목표 = 보라, 주요 목표 = 상태에 쓰지 않는 accent 색 하나. 채움은 옅은 면 + 전경색 글자로, 다크에서도 같은 규칙.
7. **면 층위 3단계만.** 바탕 `--canvas` < 작업 면 `--surface` < 떠 있는 면 `--surface-raised`(메뉴·입력창·토스트). 선택 표시를 면 단계로 만들지 않는다. 다크 값은 tokens.css 한 곳.
8. **반전(inverse)은 짧게 뜨는 것에만**(툴팁 = Montage Tooltip). 테마에 따라 밝기가 뒤집히는 반전 면을 주 행동·선택·토스트에 쓰지 않는다.
9. **글자 위계 6단계.** 화면 제목·구역 제목·카드 제목·본문(`neutral-primary`)·보조(`neutral-secondary`)·메타(`neutral-tertiary`). 읽을 내용은 보조색으로 쓰지 않는다.
10. **검사.** PR마다 아래를 확인한다.
    - `git grep -n 'data-theme="dark"'` 결과 목록이 늘지 않았는지
    - C-1 hex 스크립트 결과가 늘지 않았는지
    - `color: var(--surface|--primary)`, `background: var(--brand)`가 0인지
    - 렌더 확인(라이트·다크, 360·768·1440)은 사용자가 맡는다.

---

## 확인하지 못한 것

- 렌더링, 빌드, typecheck, test는 하나도 실행하지 않았다(Node 없음). 모든 시각 판단은 코드 추론이다.
- Montage 토큰 실제 값, `--radius-full`·`--radius-28`·`--spacing-2/6/10/14`가 실제로 있는지, Montage Switch·Checkbox가 그리는 DOM(C-10 영향)은 확인하지 못했다.
- B-2(토스트 다크), B-8(달력 다크), B-6(사이드바 아이콘 색), D-5 체감은 [추측]이라 사용자가 화면에서 확인해야 한다.
