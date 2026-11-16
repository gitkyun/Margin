# 디자인

마진 화면의 시각 기준은 **Wanted Montage 4.2.0**입니다. 색·글자·간격·모서리·그림자·테마·너비 기준과 공통 버튼은 Montage 공식 패키지에서 가져오고, 마진이 따로 만든 색상표는 두지 않습니다. 이 문서가 디자인 관련 문서의 시작점입니다.

| 문서 | 내용 |
|---|---|
| 이 문서 | 기반 구조, 새 화면을 만들 때 쓰는 것과 쓰지 않는 것 |
| [이전 기록](migration.md) | 바꾼 것, 남은 별칭과 이전 CSS, 다음 단계 |
| [참고자료](references.md) | 공식 버전·링크·Figma·토큰 아카이브 위치(원본은 저장소에 두지 않음) |
| [UX 라이팅 원칙](ux-writing.md) | 문구·용어·상태 구분 |
| [UI 품질 기준](ui-quality.md) | 렌더링된 화면에서 확인할 동작·줄바꿈·너비·테마 |
| [화면 규칙](patterns.md) | 색 역할, 화면 머리 순서, 움직임 단계 |

## Kokonut 원본 도입 예외 (2026-11-16 사용자 결정)

Kokonut 부품은 공식 데모의 실제 소스를 `src/components/kokonut/`에 도입합니다. 이 범위에서는 원본의 JSX 구조·치수·여백·정렬·상태 전환·모션과 Radix/shadcn 기반 부품을 유지합니다. Montage는 색상과 Pretendard 글꼴의 출처입니다. 원본 메뉴·버튼·입력창을 Montage 부품으로 교체하거나, 기존 화면 CSS를 덧씌워 비슷하게 다시 만들지 않습니다.

한국어 문구·일본어 사전·실제 모델/기록/메일/녹음 연결은 마진 어댑터에서 처리합니다. 원본의 예시 데이터·가상 진행·가짜 성공 상태는 실제 기능에 쓰지 않습니다. 계정 전환 등 없는 기능과 Tiptap 입력 엔진, 사이드바에 맞춘 팝업 위치처럼 불가피한 차이만 [매핑표](kokonut-map.md)에 기록합니다. 모바일·시각 검수는 사용자가 이후 진행합니다.

## 1. 기반 구조

| 축 | 출처 | 위치 |
|---|---|---|
| 토큰 | `@montage-ui/core/theme.css`의 `--semantic-*`·`--atomic-*`·`--spacing-*`·`--radius-*`·`--typography-*` | `src/main.tsx`에서 전역으로 불러옴 |
| 앱 별칭 | 예전 변수 이름(`--surface`, `--text` 등)을 Montage 변수로 연결 | `src/design/tokens.css` 한 곳 |
| 테마 | Montage `ThemeProvider`(쿠키 `margin-theme`, 이 호스트에서만) | `src/lib/theme.tsx`, 첫 화면 `public/theme-bootstrap.js` |
| 초기화(reset) | Tailwind Preflight 하나. Montage `reset.css`·`global.css`는 쓰지 않음 | `src/styles.css` |
| 너비 | Montage breakpoint xs 0 · sm 768 · md 992 · lg 1200 · xl 1600 | `src/design/responsive.ts` |
| 버튼 | Montage `Button`·`TextButton`·`IconButton` | `src/components/ui/button.tsx` |

테마·너비·컴포넌트 크기·상태는 서로 다른 축입니다. ‘모바일 다크’처럼 둘을 묶은 토큰을 만들지 않습니다.

### 테마

- 선택값은 라이트·다크·시스템 세 가지이고 기본은 시스템입니다. 로그인 후에는 계정 설정 → 화면에서만 바꾸고, 공개 화면 푸터의 전환은 별도로 허용합니다.
- `html[data-theme]`이 실제 적용 테마입니다. Montage가 이 값에서 시맨틱 변수를 바꾸므로 CSS에 다크 전용 색을 다시 쓰지 않습니다. 다크에서만 다른 처리가 꼭 필요하면 `[data-theme="dark"]` 선택자를 씁니다(`.dark` 클래스는 없앴습니다).
- 첫 화면 깜빡임 방지: Vite SPA에서는 Montage가 렌더링하는 인라인 스크립트가 실행되지 않고, CSP도 인라인 스크립트를 막습니다. 그래서 `public/theme-bootstrap.js`를 `<head>`에서 동기로 불러옵니다.
- 예전 저장값 `localStorage.rms-theme`은 처음 한 번 쿠키로 옮기고 `margin-theme-migrated`로 표시합니다. 예전 키는 지우지 않습니다.
- React에서는 `useTheme()`(호환)을 그대로 쓰거나 Montage `useThemeControl()`을 씁니다.

### 색

- 새 코드는 Montage 시맨틱 변수(`var(--semantic-foreground-neutral-primary)` 등)나 Montage 컴포넌트를 바로 씁니다. 별칭은 기존 CSS를 옮기는 동안만 씁니다.
- hex·rgb 값을 새로 쓰지 않습니다. 반투명이 필요하면 `rgba(var(--semantic-…-rgb), var(--opacity-…))`를 씁니다.
- Montage 값을 대비 보정 목적으로 바꾸지 않습니다(2026-11-09 결정). 공식 값과 다른 색이 필요하면 먼저 Montage 토큰 중에서 고릅니다.
- 소개 화면의 Cloud Shader·마스코트·푸터 칸 글자 그림은 브랜드 그림이라 자체 색을 유지합니다.

### 컴포넌트

| 마진 | Montage | 비고 |
|---|---|---|
| `Button` default | `Button` solid · primary | 크기 xs 28 · sm 32 · 기본 40 · lg 48 |
| `Button` secondary / outline / destructive | `Button` solid assistive / outlined assistive / solid negative | |
| `Button` ghost / link | `TextButton` assistive / primary | |
| `Button size="icon*"` | `IconButton` | ghost→normal, outline→outlined |
| `Button asChild` | `Button as={자식 요소}` | `<Link>`를 버튼 모양 링크로 |

- `data-slot="button"`은 화면 배치(여백·격자 위치) 선택자로만 남깁니다. 이 선택자로 색·높이·모서리·글자 크기를 덮지 않습니다.
- 대화상자·시트·메뉴는 Montage Modal·Menu를 감싼 래퍼(`components/ui/dialog.tsx`·`sheet.tsx`·`dropdown-menu.tsx`)입니다. 닫으면 연 버튼으로 포커스를 돌려주는 동작은 래퍼가 맡습니다.
- 알림은 `sonner`를 유지하고 현재 테마를 넘깁니다.

## 2. 새 화면 체크리스트

1. 필요한 요소가 Montage에 있는지 먼저 봅니다(montage.wanted.co.kr). 있으면 그대로 씁니다.
2. 색·간격·모서리는 Montage 변수로. 화면 하나에만 쓰는 임시 값을 만들기 전에 토큰에서 고릅니다.
3. 새 전역 덮어쓰기 파일(`*-refinements.css`, `final-overrides.css` 등)을 만들지 않습니다. 스타일은 그 화면의 CSS 파일에 둡니다.
4. 클래스 이름은 검색 후 정합니다. 다른 화면의 클래스를 재사용해 모양을 빌리지 않습니다.
5. 문구는 [UX 라이팅 원칙](ux-writing.md), 확인은 [UI 품질 기준](ui-quality.md)을 따릅니다.

## 3. 브랜드

노출 이름은 한글 **마진**(로고·워드마크 이미지와 영문 자산은 Margin)입니다. 로고·파비콘·캐릭터는 `public/brand`, 구성은 `src/components/brand/Brand.tsx`에 있습니다. 내부 RMS·Margin 식별자와 저장 키는 브랜드 정리 대상이 아닙니다. 글꼴은 Pretendard(Montage 기본 글꼴 목록의 첫 항목)를 자체 호스팅합니다.

캐릭터는 AI 상태·안내에만 쓰고 상태 문구를 함께 둡니다. 완료 캐릭터를 교수 승인으로 표현하지 않습니다. 공개 소개의 구름·도트는 동작 줄이기를 따릅니다. 로그인 후에는 구름·유리·광학 굴절 효과를 쓰지 않습니다.

외부 구성요소 출처는 [고지](../../apps/home-preview/THIRD_PARTY_NOTICES.md), Cloud Shader의 채택·변형은 [출처 기록](aceternity-sources-20261106.md)에 있습니다.
