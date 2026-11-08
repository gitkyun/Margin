# Aceternity 적용 기록 · 2026-11-06

이번 변경은 RMS 소개 페이지를 위한 구현이다. 참고한 컴포넌트가 모두 설치되었다고 표현하지 않는다. 화면 연결·시각 검증 여부는 개발 검증 기록에 별도로 남긴다.

## 직접 채택한 소스

### Cloud Shader

- 공식 설명: https://ui.aceternity.com/components/cloud-shader
- 실제 내려받은 공개 레지스트리: https://ui.aceternity.com/registry/cloud-shader.json
- 작성자: Manu Arora <hi@manuarora.in>
- 원본 파일: `components/ui/cloud-shader.tsx`
- 원본 SHA-256: `4a0fd073ef2939b05b7a1d796b43574c94acc17a6bf65f35f7933ab8156cd60e`
- RMS 파일: `apps/home-preview/src/components/marketing/CloudShader.tsx`
- 원본 GLSL의 비대칭 구름·노이즈·그림자를 채택했다. React 수명주기·성능 제한·스타일을 RMS 환경에 맞추고, 사용자 요청으로 고정된 해 번짐을 선택 가능한 uniform으로 바꿨다.
- 조정: 소개 화면 속도 0.35(사용자 요청으로 0.25에서 소폭 증가), 기본 구름 3개. 하늘 위 `#72afea`, 아래 `#d6eafe`, 구름 `#f8fbff`, `sunIntensity=0`으로 푸른 하늘과 해 없는 장면을 사용한다. 색상·개수·속도·광원 강도는 컴포넌트 옵션으로 조절 가능하며 방문자용 설정 패널을 추가하지 않았다. 장식 캔버스의 해상도는 DPR 1.5 및 너비 1600px 내로 제한하며 최대 약 30fps로 그린다. 화면 밖·비활성 탭에서는 정지한다. 동작 감소 설정에서는 한 장면만 그린다.
- WebGL을 사용할 수 없거나 문맥이 유실되면 CSS 하늘 배경을 유지한다. 문맥 복원 시 다시 초기화한다. 내용·버튼은 캔버스와 분리하고 캔버스는 포인터·보조 기술에서 제외했다.
- Three.js 등 새 런타임 의존성은 추가하지 않았다.

## 동작을 참고해 RMS에서 작성한 구현

| 참고 | RMS 파일·구현 | 구분 |
|---|---|---|
| Card Spotlight · https://ui.aceternity.com/components/card-spotlight | `MarketingEffects.tsx`의 `SpotlightCard`: 포인터 위치의 방사형 조명과 포커스 상태 | 문서에 설명된 상호작용을 기존 Motion으로 새로 작성. 원본 코드 복사 아님 |
| Compare · https://ui.aceternity.com/components/compare | `ComparePreview`: 원고의 이전·수정 예시를 가운데 화살표 드래그·키보드로 0~100% 비교 | RMS 텍스트·HTML을 위한 새 구현. 실제 원고 버전 비교 기능과 구분 |
| Animated beam의 합류 표현, 사용자가 지정한 Modulify 연결 그림 | `MergeFlow`: 메모·피드백·자료 칩에서 작은 연구 도우미 노드로 이어지는 경로 | RMS SVG·Motion 일러스트. 가상 자료의 제품 동작 설명이며 실제 처리 상태 아님 |
| 사용자 지정 AI 캐릭터 참고 | `AssistantGlyph`: CSS로 작성한 작은 파란 얼굴 | RMS 자체 그림. 타 서비스 브랜드·캐릭터 파일 사용 안 함 |

## 사용 조건 확인

- 공식 이용 조건: https://ui.aceternity.com/licence (2026-11-06 확인).
- 공식 페이지는 Aceternity License를 명시한다. 이를 MIT라고 표시하지 않는다.
- 완성된 웹사이트·웹앱에서 사용·변형하는 범위로 채택했다. 컴포넌트 소스·템플릿·스톡 상품으로 별도 재배포하는 용도는 포함하지 않는다.
- 원본 컴포넌트 저작권은 작성자에게 남는다. 이 기록은 출처·변형 범위를 식별하기 위한 것이며 모든 Aceternity 유료 블록 이용 권한을 확보했다는 뜻이 아니다.

## 높이·마감 조정

- 상단 구름 미리보기: 데스크톱 680px / 모바일 610px 고정. 제품 본문은 450px / 모바일 430px이며 넘치는 내용은 내부에서 스크롤한다. 탭 변경으로 외곽 높이가 변하지 않는다.
- ‘연구의 어느 순간에도’: 데스크톱 720px / 태블릿·모바일 680px 고정. 제목·설명·제품 미리보기의 행을 고정해 기능 탭별 크기를 유지한다. 기능 카드 시각 영역도 데스크톱 최소 360px / 작은 화면 325px로 넓혔다.
- 하단 ‘연구 시작하기’: 진한 파랑·하늘색의 선명한 다중 그라데이션과 흰 CTA. 푸터도 블루톤을 유지하고 배경을 경계보다 160px 위로 확장했다.
- 푸터 도트: `FooterDotField.tsx`의 RMS 자체 Canvas 구현. 느린 파동과 포인터 주변 반응을 제공한다. 약 30fps, DPR 최대 1.5·너비 최대 2048px. 화면 밖·비활성 탭에서는 정지하며 동작 감소 설정에서는 정적인 장면을 표시한다. Canvas 불가 시 CSS 도트 배경을 유지한다. 과거 회전 도트 궤도와 다른 구현이다.
- 푸터 카드: 사방 모서리, 아래 그림자, 바깥 아래 여백 64px / 모바일 40px.
- `FooterControls.tsx`: 실제 테마 상태에 연결한 라이트·다크·시스템 선택과 문서 스크롤 루트까지 이동하는 맨 위로 버튼. 로그인 후 설정의 위치는 변경하지 않았다.
- `TextEffects.tsx`: [Text Generate Effect](https://ui.aceternity.com/components/text-generate-effect)와 [Container Cover](https://ui.aceternity.com/components/container-cover)의 표현 방식을 참고해 기존 Motion·CSS로 새로 작성했다. 원본 소스 복사·추가 패키지 설치가 아니다. 제목 등장 시 선명해지는 효과, 두 번째 제목 줄의 호버 밑줄·짧은 빛 이동을 적용했다. 실제 텍스트는 읽기·선택 가능하며 동작 감소 설정을 따른다.

## 탐색·추가 푸터 마감

- Modulify 공식 페이지(https://modulify.ai/)의 헤더는 Solutions·Resources 묶음과 Pricing 등의 직접 이동을 제공하며, 푸터는 관련 페이지들을 나누어 연결한다. 사용자 첨부에서는 불투명한 큰 카드 바깥에 선명한 도트·그라데이션이 배치되어 있다. 실제 로그인·호버 조작을 새로 검증한 것은 아니다.
- RMS는 필요한 기능 소개·플랜·사용 안내·개인정보 안내만 연결한다. 실제 내용이 없는 기업·SNS·문의 페이지는 추가하지 않았다. `PublicNavigation.tsx`는 기존 Radix NavigationMenu의 열기·키보드·닫기 동작을 사용하고 자체 스타일을 적용했다. 새 shadcn 템플릿이나 Aceternity 유료 헤더 블록이 아니다.
- 푸터의 도트 간격·명도와 하단 블루 방사형 그라데이션을 강화했다. 기존처럼 확장 배경 하나만 사용하므로 두 배경의 시작점이 가로선으로 드러나지 않는다. 앞선 블루톤 결정에 맞춰 참고 이미지의 주황색은 가져오지 않았다.

## 2026-11-06 브랜드 자산 반영

위 기록의 자체 CSS 얼굴은 사용자 제공 Margin 캐릭터 PNG로 교체했다. 합류·기능 소개·대화의 배치는 유지하며 표정·크기·모델 문구는 [Margin 적용 기록](README.md)을 따른다. Aceternity 캐릭터 자산으로 표기하지 않는다.
