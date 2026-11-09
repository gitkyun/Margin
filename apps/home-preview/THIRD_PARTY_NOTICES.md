# 외부 구성요소 고지

- **Disarto Icons / disarto-icons-react 1.0.0** · Disarto · MIT. https://github.com/Disarto/disarto-icons · 사용 아이콘을 정적 import해 필요한 아이콘만 묶는다. MIT 전문은 `public/licenses/Disarto-MIT.txt`에 보존한다.
- **Pretendard Variable** · Kil Hyung-jin · SIL Open Font License 1.1. https://github.com/orioncactus/pretendard · `public/licenses/Pretendard-OFL.txt`와 글꼴을 함께 제공한다.
- **shadcn/ui** · MIT. https://github.com/shadcn-ui/ui · Radix 기반 공통 UI를 로컬 코드로 수정했다.
- **PDF.js** · Mozilla Foundation · Apache-2.0. https://github.com/mozilla/pdf.js · npm의 `pdfjs-dist`를 사용하며 패키지의 라이선스 고지를 유지한다.
- React, Vite, TanStack Query, React Router, Tailwind, Radix 및 Supabase 라이브러리는 `package-lock.json`에 실제 버전을 고정한다. 각 배포 패키지의 라이선스를 따른다.

참고 이미지의 픽셀·브랜드 자산은 배포 앱에 복제하지 않았다. Morphing Icons의 상태 전환 아이디어를 참고했지만 코드를 복사하지 않았다. Skullet은 채택하지 않았다. 앱의 가상 PDF와 도트 상태 표시는 RMS에서 직접 작성했다.

PDF.js 배포의 CMap·표준 글꼴·WASM 보조 파일은 `public/pdfjs/`에 빌드 전에 복사하며, 함께 복사한 라이선스 파일을 유지합니다.

- Motion (`motion`, MIT): 감소된 움직임 설정과 소개 화면 상태 전환에 사용한다. 소개 탭·상태 전환 및 직접 작성한 비교·합류 그림에 사용한다. Aceternity Cloud Shader의 실제 소스 채택은 아래 별도 항목을 따른다.


## 2026-11-05 추가 구성

- Tiptap React/StarterKit/Table 3.32.2 · MIT · https://github.com/ueberdosis/tiptap · 기본 편집기만 사용. RMS 자체 버전 기록/비교이며 유료 플랫폼 기능은 사용하지 않는다.
- React PDF renderer 4.9.0 · MIT · https://github.com/diegomura/react-pdf · 보존 PDF 생성. PDF용 Pretendard Regular 1.3.9도 기존 OFL 고지에 포함한다.
- FullCalendar React 7.1.4 · MIT · https://github.com/fullcalendar/fullcalendar · 무료 표준 보기/테마만 사용.
- React Flow (`@xyflow/react`) 12.12.1 · MIT · https://github.com/xyflow/xyflow · 연구 단계 다이어그램.
- jsdiff (`diff`) 9.0.0 · BSD-3-Clause · https://github.com/kpdecker/jsdiff · 문자/단어 변경 비교.
- Magic UI 및 Aceternity의 Cloud Shader를 제외한 구성은 상호작용 참고다. MagicCard·AnimatedList·Dock·도트·트리는 RMS가 Motion/Canvas/CSS로 직접 구현했다. 해당 서비스의 공식 소스를 복사하거나 유료 블록을 채택했다고 주장하지 않는다.

설치 패키지의 실제 버전과 라이선스 표기는 로컬 package.json에서 확인했다. 전달 소스의 package-lock.json을 보존하고 배포 패키지의 라이선스 고지를 삭제하지 않는다.

- [Compass](https://compass.designcompass.org/components) 1.0.14의 검색·선택·탭을 상호작용 참고로 확인했다. Compass 원본 코드·전역 스타일·브랜드·유료 자료를 배포 소스에 복사하지 않았다. 해당 동작은 RMS의 기존 React/Radix/Motion으로 구현했으며, Compass 전체가 MIT라는 표기를 하지 않는다.

- Aceternity Cloud Shader (Manu Arora, Aceternity License): 공개 레지스트리의 GLSL을 소개 배경에 채택·변형했다. 원본·라이선스·변경 범위는 `../../docs/design/aceternity-sources-20261106.md`에 기록했다. MIT 라이선스로 재표기하지 않는다.

## 2026-11-09 디자인 시스템

- Montage (`@montage-ui/core`, `@montage-ui/icon` 4.2.0, 내부 의존 `@montage-ui/engine`·`@montage-ui/theme` 4.2.0) · Wanted Lab · MIT · https://github.com/wanteddev/montage-web · 색·글자·간격 토큰, 테마(쿠키 저장), 공통 버튼의 기준. 공식 CSS 변수(`theme.css`)와 공개 API만 사용한다. 스타일 엔진 의존 Emotion(`@emotion/react`·`@emotion/cache`·`@emotion/serialize`·`@emotion/utils`, MIT)을 함께 설치한다.
- `@ybouane/liquidglass`와 이를 위한 `patch-package`는 로그인 후 광학 굴절 금지 기준에 따라 제거했다.
