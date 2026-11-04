# 외부 구성요소 고지

- **Disarto Icons / disarto-icons-react 1.0.0** · Disarto · MIT. https://github.com/Disarto/disarto-icons · 사용 아이콘을 정적 import해 필요한 아이콘만 묶는다. MIT 전문은 `public/licenses/Disarto-MIT.txt`에 보존한다.
- **Pretendard Variable** · Kil Hyung-jin · SIL Open Font License 1.1. https://github.com/orioncactus/pretendard · `public/licenses/Pretendard-OFL.txt`와 글꼴을 함께 제공한다.
- **shadcn/ui** · MIT. https://github.com/shadcn-ui/ui · Radix 기반 공통 UI를 로컬 코드로 수정했다.
- **PDF.js** · Mozilla Foundation · Apache-2.0. https://github.com/mozilla/pdf.js · npm의 `pdfjs-dist`를 사용하며 패키지의 라이선스 고지를 유지한다.
- React, Vite, TanStack Query, React Router, Tailwind, Radix 및 Supabase 라이브러리는 `package-lock.json`에 실제 버전을 고정한다. 각 배포 패키지의 라이선스를 따른다.

참고 이미지의 픽셀·브랜드 자산은 배포 앱에 복제하지 않았다. Morphing Icons의 상태 전환 아이디어를 참고했지만 코드를 복사하지 않았다. Skullet은 채택하지 않았다. 앱의 가상 PDF와 도트 상태 표시는 RMS에서 직접 작성했다.

PDF.js 배포의 CMap·표준 글꼴·WASM 보조 파일은 `public/pdfjs/`에 빌드 전에 복사하며, 함께 복사한 라이선스 파일을 유지합니다.
