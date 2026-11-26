# MARGIN 10분절 전수 감사 — 신규 발굴 결함 24건

- **작성일**: 2026-11-26
- **범위**: 1~10분절 전수 감사 중 기존 Phase 1~4 문서(`02-product-evaluation.md`, `06-independent-review.md`, `07-decision-ledger.md`, `08-micro-detail-audit.md`)에 기록되지 않았거나 미확정이었던 항목 중, 실제 스크린샷과 소스 코드(`Margin-repo` HEAD `4fce15e`) 대조로 **새로 확정된 결함 24건**만 선별해 기록합니다.

## 1. 치명적 기능·데이터·권한 버그 (6건)

1. **원고 버전 복원 시 `v2` 중복 생성**
   - **근거**: `Margin-repo/apps/home-preview/src/pages/WritingPage.tsx:502-527`, `2026-11-25_5단계-전_화면수집_v2/_보강수집/원고-화면/15-writing-restore-history.png`
   - **현상**: `restoreVersion()`이 현재 내용 백업과 복원본 저장을 위해 `save("documentVersions", { number: 0 })`을 연속 2회 호출하면서, 갱신 전 상태 기준으로 번호가 매겨져 `v3 · v2 · v1` 대신 `v2 · v2 · v1`로 중복 생성됩니다.

2. **데스크톱 피드백 목록에서 상태·할 일 카운트(`<small>`) 통째로 증발**
   - **근거**: `Margin-repo/apps/home-preview/src/components/tasks/tasks.css:49-51`, `Margin-repo/apps/home-preview/src/pages/tasks/TasksHome.tsx:442-451`, `assets/live-desktop-deep/d02_itemdetail_feedback.png`
   - **현상**: `@container tasks (min-width: 960px)`에서 할 일 줄의 보조 줄을 숨기는 `.tasks-home .task-line-text small { display: none; }` 규칙이 우측 3열(`.task-line-cols`)이 없는 `FeedbackLine`에도 적용돼, 데스크톱 피드백 탭에서 모든 피드백의 상태(`시작 전`/`진행 중`)와 `할 일 0/1` 정보가 사라집니다.

3. **편집자(공동연구자) 계정에서 모든 할 일 출처가 `직접 추가`로 왜곡**
   - **근거**: `Margin-repo/apps/home-preview/src/lib/task-groups.ts:94-105`, `assets/live-professor-editor/e05_editor_tasks.png`
   - **현상**: 소유자 화면(`d01_itemdetail_task.png`)에서는 `제5차 논문 지도`, `2장 초안 서면 의견`으로 정상 표시되는 할 일 3건이, 편집자 계정에서는 `taskSource()`가 접근 가능한 `meetings` 매칭 실패 시 무조건 `"직접 추가"`를 반환해 모두 거짓 표기됩니다.

4. **미팅 `goal`이 저장돼 있는데도 `"아직 준비한 내용이 없어요."` 표시**
   - **근거**: `NextMeetingPreview.tsx` (5분절 감사)
   - **현상**: `제7차 논문 지도`에 `goal`이 저장돼 있고 `[다음]` 배지도 붙어 있는데 `NextMeetingPreview`가 `goal`을 확인하지 않아 빈 상태로 표시하고 `[홈의 다음 미팅으로 지정]` 버튼도 남아 있습니다.

5. **미팅 상세 우측 `피드백·할 일` 카운트가 피드백 수를 누락**
   - **근거**: `Margin-repo/apps/home-preview/src/components/meetings/RecordSide.tsx:242`, `assets/live-desktop-deep/d10_meeting_written_kakao.png`, `2026-11-25_5단계-전_화면수집_v2/_보강수집/미팅-조율/meeting-08-reopened-source.png`
   - **현상**: 헤더 제목은 `피드백·할 일`인데 계산은 `items.remaining` / `items.tasks.length`(할 일 수만)로 처리해, 피드백이 1~2건 있어도 할 일이 없으면 `남은 0 / 전체 0`으로 표시됩니다.

6. **녹음 `음성 공유` 클릭 시 확인·알림 없이 즉시 공개**
   - **근거**: `Margin-repo/apps/home-preview/src/components/RecordingPanel.tsx:475-491`, `assets/live-desktop-deep/d07_meeting_recorded_audio.png`
   - **현상**: `음성 공유` 클릭 시 확인 대화상자나 토스트 알림 없이 즉시 `visibility: "shared"`로 저장되어 공동연구자에게 음성이 바로 노출됩니다.

## 2. 화면 깨짐·잘림·오표시 (8건)

7. **피드백 상세 5단계 진행 점 라벨 실종**
   - **근거**: `Margin-repo/apps/home-preview/src/components/item-detail/item-detail.css:295-330`, `assets/live-desktop-deep/d02_itemdetail_feedback.png`
   - **현상**: CSS 주석의 "280px에서는 점과 지금 칸 글자만 표시" 규칙이 미구현되어 기본 패널 폭(312px)에서 `.item-detail-step { display: none; }`으로 숨겨지고, 라벨 없는 파란 점 5개(`● ● ● ● ●`)만 둥둥 떠 있습니다.

8. **피드백 녹음 클립 타임라인 눈금 겹침**
   - **근거**: `assets/live-desktop-deep/d02_itemdetail_feedback.png`
   - **현상**: 312px 상세 패널 안에서 `SourceAudioClip` X축 눈금 11개(`0s`~`150s`)가 전부 렌더링되어 `90s105s120s135s150s`가 완전히 겹쳐 읽을 수 없습니다.

9. **저장된 녹음 카드 `음성 공유` 버튼 오른쪽 잘림 확정**
   - **근거**: `assets/live-desktop-deep/d07_meeting_recorded_audio.png`, `assets/live-desktop-deep/d08_meeting_transcript.png`
   - **현상**: `재생` 오른쪽 `음성 공유` 버튼 끝(`유` 글자)이 카드 테두리에 닿아 잘립니다(`P07-4` 미확정 항목을 실제 결함으로 확정).

10. **서면 피드백 등록 모달 하단 `공개 범위` 잘림**
    - **근거**: `Margin-repo/apps/home-preview/src/components/meetings/WrittenFeedbackDialog.tsx:157, 177`, `assets/live-desktop-deep/d11_dialog_new_written.png`
    - **현상**: `내용` 입력창이 `rows={10}`으로 커서 1440×900에서도 하단 `공개 범위` 선택 영역이 모달 바닥 아래로 잘려 파란 테두리 끝만 보이고, `어디서 받았나요`는 네이티브 `<select>`라 옆 `DateField`와 스타일이 갈립니다.

11. **모바일 320px 할 일 첫 화면에 할 일 0건 노출 & `내 할 일 | 모두` 우측 잘림**
    - **근거**: `assets/live-mobile/tasks_320.png`
    - **현상**: 상단 주간 달력 + 세그먼트 + 검색 + 필터 3줄이 첫 화면을 전부 차지해 `기한 지남 3` 헤더만 반쪽 보이고 할 일이 단 1건도 보이지 않으며, `내 할 일 | 모두` 컨트롤 오른쪽 끝이 320px 뷰포트 밖으로 잘립니다.

12. **모바일 연구 도우미 하단 탭 이중 활성**
    - **근거**: `2026-11-25_5단계-전_화면수집_v2/_보강수집/AI-대화-모의/mobile-model.png`
    - **현상**: `연구 도우미` 화면인데 하단 탭 바에서 `홈`과 `연구 도우미` 두 탭이 동시에 파란색 활성 상태로 표시됩니다.

13. **삭제된 검토 댓글에 `답글`·`해결로 표시`·`···` 잔존 & 카운트 포함**
    - **근거**: `assets/live-professor-editor/p06_prof_review_pin_mode.png`
    - **현상**: `"삭제한 댓글이에요."` 플레이스홀더 아래에 `답글`, `해결로 표시`, 우측 `···` 메뉴가 그대로 활성화돼 있고 상단 `댓글 3` 카운트에도 포함됩니다. 핀 모드 진입 시 PDF 위 위치 선택 안내나 취소 버튼도 보이지 않습니다.

14. **전역 토스트 & 업로드 트레이가 우측 레일 하단 버튼·푸터 링크를 가림**
    - **근거**: `assets/isolated-local/01_task_done_toast_1440.png`, `assets/isolated-local/06_upload_invalid_or_error_1440.png`, `2026-11-25_5단계-전_화면수집_v2/_보강수집/원고-화면/07-upload-mixed-result.png`, `15-writing-restore-history.png`, `meeting-08-reopened-source.png`
    - **현상**: 우측 하단 토스트가 우측 레일 하단 `패널 토글`·`설정` 버튼을 완전히 덮고, 업로드 큐 트레이는 푸터의 `자료·개인정보 안내` 링크를 절반 가립니다.

## 3. 일관성·UX·문구 결함 (10건)

15. **PDF 새 버전 추가 모달에서 파일 미선택 시 primary 버튼 활성화**
    - **근거**: `Margin-repo/apps/home-preview/src/pages/docs/MaterialUpload.tsx:307, 327, 379`, `assets/live-desktop-deep/d21_dialog_pdf_new_version.png`
    - **현상**: `새 글`·`폴더 만들기`와 달리 `disabled={saving}`만 검사해 파일 미선택 상태에서도 `[✓ 새 버전 추가]`가 진한 파란색 활성 상태입니다. 또한 한 모달 안에서 `자료 유형`은 네이티브 `<select>`, `폴더`는 커스텀 `Choice`로 혼용됩니다.

16. **원고 `문장 점검` 버튼 ↔ `수정 제안받기` 모달 제목 불일치**
    - **근거**: `Margin-repo/apps/home-preview/src/pages/docs/EditorHeader.tsx:180-191`, `assets/live-desktop-deep/d17_editor_writing_review_dialog.png`
    - **현상**: 헤더 버튼은 `문장 점검`인데 열리는 모달 제목은 `수정 제안받기`, 실행 버튼은 `제안받기`로 용어가 어긋납니다.

17. **원고 저장 실패 시 `다시 시도`가 평문처럼 묻힘**
    - **근거**: `Margin-repo/apps/home-preview/src/pages/docs/EditorHeader.tsx:125-128`, `2026-11-25_5단계-전_화면수집_v2/_보강수집/원고-화면/16-writing-save-failed.png`
    - **현상**: `variant="ghost"`를 써서 옆 `저장 실패`·`나만 보기` 회색 텍스트와 구분되지 않아 클릭 가능한 복구 버튼인지 알기 어렵습니다.

18. **원고 버전 비교 무변경 안내 부재 & 단어 diff 줄바꿈 뭉개짐**
    - **근거**: `assets/live-desktop-deep/d18_editor_compare_worddiff.png`, `2026-11-25_5단계-전_화면수집_v2/_보강수집/원고-화면/13-writing-restore-before.png`
    - **현상**: 차이가 없어도 `"달라진 내용이 없어요."` 안내 없이 `[이 버전으로 되살리기]`가 활성화되며, 단어 diff에서 문단 경계 줄바꿈이 뭉개져 문장이 붙습니다.

19. **원고 저장 충돌 모달에서 공동연구자 본문 덮어쓰기(`내가 쓴 내용 유지`)가 primary 강조**
    - **근거**: `Margin-repo/apps/home-preview/src/pages/WritingPage.tsx:761-798`, `2026-11-25_5단계-전_화면수집_v2/_보강수집/원고-화면/20-writing-conflict-options.png`
    - **현상**: 공동연구자 저장본이 빨간 취소선(`삭제`)으로 표시되고 덮어쓰기 버튼인 `[내가 쓴 내용 유지]`가 파란 primary로 강조돼 실수 덮어쓰기 위험이 큽니다.

20. **결정·질문 상세 패널 본문·이유 편집 UI 부재 & `결정` 탭 개수 누락**
    - **근거**: `Margin-repo/apps/home-preview/src/components/item-detail/ItemDetail.tsx:663-729`, `assets/live-desktop-deep/d03_sidepanel_decisions.png`, `assets/live-desktop-deep/d04_itemdetail_decision.png`
    - **현상**: `DecisionBody`와 `QuestionBody`가 `<p>` 읽기 전용으로만 렌더링되어 편집 기능이 없고, 사이드패널 `질문 2`와 달리 `결정` 탭에는 개수가 누락되어 있습니다.

21. **할 일 완료 시 이중 `되돌리기` & 목록/탭 카운트 불일치**
    - **근거**: `Margin-repo/apps/home-preview/src/pages/tasks/TasksHome.tsx:167-178`, `assets/isolated-local/01_task_done_toast_1440.png`
    - **현상**: 행 오른쪽 `[되돌리기]` 버튼과 하단 검은 토스트 `[되돌리기]`가 동시에 뜨고, 탭 배지는 `할 일 2`인데 화면엔 `기한 지남 1`(lingering) + `이번 주 2` = 3줄과 하단 `오늘 끝낸 할 일 1개`가 함께 노출되어 숫자가 어긋납니다.

22. **미팅·서면 피드백 세부 불일치**
    - **근거**: `d07`, `d08`, `d10`, `meeting-02-recording.png`, `meeting-08-reopened-source.png`
    - **현상**: 서면 피드백에 구두 미팅 문구(`"들은 내용을 그대로 적거나..."`) 잔존, 기록 완료 미팅 최상단 `녹음 시작` 점선 박스 잔존, 출처 복귀 시 상세 제목 반토막 잘림·원문 강조 미이동, 음성 전용 녹음 중 빈 전사 박스 과다 점유.

23. **글·자료·PDF 뷰어 세부 불일치**
    - **근거**: `Margin-repo/apps/home-preview/src/pages/docs/DocsPage.tsx:258, 314`, `d12`, `d19`, `d20`, `docs_390.png`, `docs_320.png`, `05-pdf-mobile-390.png`
    - **현상**: `보관함` 빈 동그라미(`○`) 아이콘과 줄 메뉴 `보관`의 휴지통(`trash`) 아이콘 혼용, 모바일 폴더 사이드바 상단 절반 점유, PDF 뷰어 중복 내려받기 버튼 2개, 모바일 PDF 헤더 `[···]` 2줄 분리, PDF 텍스트 보기 표 줄바꿈 소실.

24. **설정·AI 세부 불일치**
    - **근거**: `e08_editor_settings_people.png`, `e10_editor_settings_profile.png`, `dark_settings_usage_1440.png`, `d22`, `d23`, `d24`
    - **현상**: 설정 `함께하는 사람`에서 편집자에게 초대 입력창이 열려 있고 공동연구자 초대 설명이 지도교수 문구와 모순, `사용량·플랜` `크레딧 이력` 빈 섹션 및 실행 요청 합계 1건 누락(`70 ≠ 64 + 5`), `프로필` 변경 불가 이메일의 활성 인풋 스타일, AI 모델 선택기의 가상 모델명(`Gemini 3.8 / 4 Hydrogen·Carbon·Argon`) 및 크레딧 단가 미표시.
