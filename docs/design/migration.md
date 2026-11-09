# Montage 이전 기록

2026-11-09 감사(기준 커밋 `295bf67`) 뒤 Wanted Montage 4.2.0으로 옮긴 내용과 남은 일입니다. 기준은 [디자인 README](README.md)에 있습니다.

## 1. 이번에 바꾼 것

| 영역 | 전 | 후 |
|---|---|---|
| 토큰 | `styles.css`·`experience.css`·`expansion.css`·`reference.css`·`public-site.css`·`research-home.css`가 각자 `:root`/`.dark`/`.lp-site`에서 색을 다시 정의(같은 변수가 최대 4번, 다크 주 버튼만 3가지 값) | `src/design/tokens.css` 한 곳에서 Montage 변수로 연결. 다크 블록 없음 |
| 직접 쓴 색 | CSS에 hex·rgb 약 430곳 | 26곳(소개 화면의 구름 하늘·마스코트·푸터 그라데이션·마스크 등 장식) |
| 다크 규칙 | `.dark …` 약 130개(공개 화면 108개) | `[data-theme="dark"]` 9개(로고 이미지 전환·장식 그라데이션 등). `.dark` 클래스 제거 |
| 테마 | `lib/theme.tsx` 자체 상태 + `localStorage.rms-theme` + `.dark` | Montage `ThemeProvider` + 쿠키 `margin-theme` + `public/theme-bootstrap.js`(첫 화면, 1회 이전) |
| 초기화 | Tailwind Preflight(유지) | 그대로. Montage `reset.css`는 쓰지 않음 |
| 버튼 | `.rms-button`·`[data-slot="button"]` 자체 CSS(높이 30~46px 다섯 가지) | Montage `Button`·`TextButton`·`IconButton` 어댑터. 자체 버튼 CSS 삭제 |
| 입력 | `.rms-input` 자체 CSS, 네이티브 입력 24곳 + 래퍼 21곳 | Montage `TextField`·`TextArea` 어댑터로 통일(`components/ui/input.tsx`, `textarea.tsx`). 검색 입력은 `TextField` + 아이콘. 미팅 원문 메모는 문서 영역이라 네이티브 `<textarea>` 유지 |
| 메뉴 표면 | 서리 유리(blur 24px)·LiquidGlass | Montage elevated 표면, 로그인 후 blur 제거(대화상자 배경만 유지) |
| 너비 | 768/769px 혼용 | Montage sm(768)에 맞춰 `max-width: 767px`/`min-width: 768px`. 1200 → 1199. 검토 화면은 md(992) 미만에서 한 열 |
| 알림 | sonner(항상 라이트) | sonner 유지, 현재 테마 전달 |
| 삭제 | `DotOrb.tsx`, `ui/badge.jsx`(+d.ts), `ui/separator.jsx`, `ui/sonner.jsx`(없는 `next-themes`를 import), `LiquidGlassLayer.tsx`, `@ybouane/liquidglass`, `patch-package`, `--bg`, `--surface-radius` | |

대비 보정용으로 만들었던 색(`--brand-ink` #0059e0/#83b1ff, `--text-tertiary` #646b78/#9298a3, 다크 주 버튼 #2f6be0)은 Montage 값으로 대체했습니다(2026-11-09 결정: Montage를 그대로 따르고 WCAG 대비 수치는 기준에서 뺌). 포커스 복귀·한글 조합 Enter·접근성 이름 같은 동작 수정은 그대로입니다.

## 2. 별칭 표

`src/design/tokens.css`의 별칭과 연결된 Montage 변수입니다. 숫자는 2026-11-09 기준 `src/`에서 쓰는 횟수입니다. 새 코드는 오른쪽 변수를 바로 씁니다.

| 별칭 | Montage | 사용 |
|---|---|---|
| `--canvas` | `background-neutral-secondary` | 10 |
| `--surface`, `--sidebar` | `background-neutral-primary` | 181, 4 |
| `--surface-muted` (`--surface-soft`) | `surface-neutral-secondary` (반투명) | 122, 11 |
| `--surface-sunken` | `surface-neutral-tertiary` (반투명) | 6 |
| `--text` | `foreground-neutral-primary` | 148 |
| `--text-secondary` (`--muted`) | `foreground-neutral-secondary` | 382, 28 |
| `--text-tertiary` | `foreground-neutral-tertiary` | 70 |
| `--line` (`--border`) | `line-neutral-secondary` | 300, 43 |
| `--line-strong`, `--input-line` | `line-neutral-primary` | 30, 9 |
| `--brand`, `--brand-ink`, `--tone-blue` | `foreground-brand-primary` | 164, 6, 22 |
| `--primary` | `surface-brand-primary` | 45 |
| `--brand-soft` (`--primary-soft`) | `surface-brand-subtle` (반투명) | 47, 8 |
| `--success`/`--tone-green`, `--warning`/`--tone-amber`, `--danger`/`--tone-red` | `foreground-positive/cautionary/negative-primary` | 23, 17, 22 |
| `--danger-soft`, `--danger-line` | `surface-negative-primary`, `line-negative-primary` | 6, 5 |
| `--tone-gray` | `foreground-neutral-quaternary` | 3 |
| `--panel-shadow`, `--raise-shadow`, `--shadow-pop` | `elevation-shadow-normal-xsmall/small/large` | 1, 4, 3 |
| `--topbar` (`--glass`) | `background-neutral-primary-rgb` × `opacity-88` | 2, 2 |

**주의**: `--surface-muted`·`--surface-sunken`·`--brand-soft`는 Montage 정의대로 반투명입니다. 두 판을 겹쳐 그리는 곳(예: 소개 화면 비교 데모)은 불투명한 `--canvas`·`--surface`를 써야 아래가 비치지 않습니다.

## 3. 남은 일

우선순위 순서입니다. 각 단계는 화면을 직접 보며 확인할 수 있는 크기로 나눕니다.

1. **이전 전역 CSS 파일 정리.** `experience.css`(2,217줄), `expansion.css`(2,384줄), `reference.css`(543줄), `pages/workspace-refinements.css`(557줄)는 색 정의를 걷어냈지만, 같은 선택자를 나중 파일이 다시 덮는 구조는 남아 있습니다. 규칙을 화면별 파일(`pages/*.css`)로 옮기면서 겹치는 선언을 합치고 파일을 지웁니다. 불러오는 순서가 결과를 바꾸므로 화면 하나씩 옮기고 비교합니다.
2. **별칭 줄이기.** 위 표의 별칭을 Montage 변수로 바꿔 쓰고, 사용이 0이 된 별칭부터 `tokens.css`에서 지웁니다. `--border`·`--muted`·`--surface-soft`·`--primary-soft`·`--glass`가 먼저입니다.
3. **네이티브 버튼 68곳.** `.rms-action`·`.icon-button`·`.filter-chip`·탭·선택 상자 등. 성격에 따라 Montage `Button`/`IconButton`/`Chip`/`SegmentedControl`/`Tab`으로 옮깁니다. `Choice`의 접근성 이름(‘라벨, 현재 값’)과 IME 처리를 유지합니다.
4. **대화상자·메뉴.** `components/ui/dialog.jsx`(19곳)·`dropdown-menu.jsx`·`sheet.jsx`는 Radix입니다. Montage `Modal`·`Menu`로 옮길 때 ‘연 버튼으로 포커스 복귀’(`ReturnFocusContext`)와 `FormNavigationGuard`의 ‘취소’ 버튼 인식을 테스트로 먼저 고정합니다.
5. **상태 배지.** `.status-badge`·`.tone-*`를 Montage `ContentBadge`로.
6. **너비 기준.** 남은 값(480·540·600·700·720·760·800·850·900·1000·1024·1040·1050·1100·1250·1440·1700)을 Montage sm 768 · md 992 · lg 1200 · xl 1600과 그 사이 콘텐츠 폭으로 정리합니다. 768 미만의 휴대폰 세부 조정(360~600)은 Montage에 대응 값이 없으니 화면별로 남길지 정합니다.
7. **글자 크기.** 화면 CSS의 px 글자 크기를 Montage typography 변수(`--typography-body1-fontSize` 등)로.
8. **아이콘.** `@montage-ui/icon`은 설치했지만 화면 아이콘은 아직 Disarto입니다. 바꿀지는 브랜드 판단이 필요합니다.

## 4. 확인한 것과 하지 않은 것

- 실행한 검사: `npm run typecheck`, `npm test`(132개), `npm run test:backend`(36개), `npm run test:sites`(5개), `npm run build` 통과. `prettier --check`는 이번에 건드리지 않은 `src/lib/home-meeting*.ts` 2개에서만 이전부터 실패합니다.
- 미리보기 모드 브라우저 자동 점검: 21개 화면 × 360·768·1440px × 라이트·다크에서 가로 스크롤 0건. 768px 검토 화면 찌그러짐을 찾아 고쳤고 900·1024px도 다시 확인했습니다.
- 하지 않은 것: 실제 Supabase 계정으로 로그인한 화면, 실제 마이크, 실제 AI 호출, 색 대비 수치 재측정. 시각 판단은 사용자 확인이 필요합니다.
