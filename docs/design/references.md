# 디자인 참고자료

버전과 위치만 적습니다. 원본 파일·캡처·토큰 JSON은 저장소에 커밋하지 않습니다(AGENTS.md).

| 자료 | 버전·위치 | 쓰는 방법 |
|---|---|---|
| `@montage-ui/core`, `@montage-ui/icon` | 4.2.0 (정확히 고정, 내부 `@montage-ui/engine`·`@montage-ui/theme` 4.2.0) | 앱 의존성. 공개 API와 `theme.css`만 사용 |
| Montage 소스 | [wanteddev/montage-web @ `111b514e6ab9e663df11ed3caa7aefe88c2a9c15`](https://github.com/wanteddev/montage-web/tree/111b514e6ab9e663df11ed3caa7aefe88c2a9c15) | 동작 확인용 읽기. `@montage-ui/theme` 내부 경로를 import하지 않음 |
| 공식 문서 | https://montage.wanted.co.kr | 컴포넌트 선택, 사용 예 |
| Figma | [Wanted Design System (Community), node 16222-137704](https://www.figma.com/design/dDnLuVfC2bSkDlZ1oPLcc3/Wanted-Design-System--Community-?node-id=16222-137704) | 버튼 크기 등 시각 대조 |
| 토큰 아카이브 | 팀 공유 드라이브의 `아카이브.zip`(Figma 변수 내보내기 JSON 9개: `Mode 1`, `Theme/Light·Dark`, `Component/Desktop·Mobile`, `Frame/Small~Xlarge`) | 출처 대조용. 별도 테마로 만들지 않음. `Frame`의 1100·1440은 프레임 폭이지 breakpoint가 아님 |
| 감사 보고서 | `Margin_Design_System_Audit_2026-11-09.md`(팀 공유) | 통합 전 상태 기록. 기준 커밋 `295bf67` |

버전을 올릴 때는 이 표, `apps/home-preview/package.json`, `THIRD_PARTY_NOTICES.md`를 함께 고칩니다. Montage CHANGELOG에서 토큰 이름·다크 값·ThemeProvider 쿠키 동작 변경을 먼저 확인합니다.
