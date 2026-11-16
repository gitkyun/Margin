# 논문 지도 협업 및 연구 진행 관리 서비스 유저 플로우

수정일: 2026-11-03

기준 문서: [PRD](prd.md), [기능명세서](functional-specification.md). 메뉴·화면 계층·진입 주소는 [IA·화면 목록](information-architecture.md)을 함께 본다.

이 문서는 총괄 흐름과 작업별 세부 흐름으로 구성한다. 도식의 상자는 화면·화면 안의 영역·사용자 행동을 나타내며 상자마다 별도 화면을 만드는 뜻은 아니다. 마름모는 조건 판단이고 화살표의 문구는 진입 조건이나 학생이 선택할 행동이다. 후속 기능은 별도 영역과 점선으로 구분한다. 도식은 설계 기준이며 구현·사용성 검증 결과가 아니다.

## 적용 조건과 범위

| 구분 | 적용 내용 |
|---|---|
| 사용자 확정 | 필요할 때 AI 영역 열기, 수정 방안 후보 제안과 학생 판단, 여러 항목을 한 검토 링크에 묶고 항목별 응답, 교수 계정 로그인·지정 계정 접근, 추가 수정 필요의 이유 댓글 필수, 문서 검토 근거의 보존 파일, 당시 검토 내용 보존과 학생의 명시적 재확인 요청, 다음 미팅 중심 준비 |
| 현재 작성 기준안 | 미완료 작업 수동 재선택, 요청당 교수 계정 한 개, 같은 링크에서 최신·이전 검토 차수 조회, 도식의 세부 화면·영역 구성과 초기·후속 구분 |
| 운영 전 결정 | 실제 인증 제공자·계정 복구, 파일 형식·용량·보존·삭제, 외부 AI 처리 조건, 녹음·전사의 동의·보존 정책 |
| 제외 | 교수의 다수 학생 관리 대시보드, 수정 전 방향을 묻는 별도 검토 기능, 학생 판단 없는 AI 수정·공유·연구 방향 결정 |

학생은 교수의 가입·응답과 전체 로드맵 작성 없이도 메모·피드백·할 일·미팅 준비를 사용할 수 있다. 미팅에서 물을 질문 준비는 유지한다. 이메일·푸시 자동 알림은 초기 범위에 넣지 않으며 검토 링크는 학생이 직접 복사해 전달한다.

## 수업 시연 동선

이번 구현·배포의 목표는 아래 경로를 실제 저장과 Google API 호출로 이어 수행하는 것이다. 세부 제품 흐름은 다음 절에 유지한다. [수업 시연 기준](../deployment.md)의 D01~D06을 우선 구현하며 앱·서버·배포는 구현했으며 실제 Gemini 생성은 키 연결 전이다. 최신 검증 범위는 [2026-11-04 기록](../development.md)을 따른다.

```mermaid
flowchart LR
  demo_student["D01 학생 시연 계정 로그인<br/>연구·미팅 메모 저장"] --> demo_ai["D02 Google API 실제 호출<br/>정리·복수 수정 방안 편집·저장"]
  demo_ai --> demo_prepare["D03 할 일·다음 미팅 준비<br/>보여줄 결과·자료·질문"]
  demo_prepare --> demo_share["D04 v2 보존 파일·수정 결과<br/>두 항목을 한 검토 링크로 공유"]
  demo_share --> demo_professor["D05 별도 교수 계정 로그인<br/>항목별 결과·필수 이유 저장"]
  demo_professor --> demo_recheck["D06 학생 새 응답 확인<br/>v3로 해당 항목만 재확인"]
  demo_recheck --> demo_history["v2·이전 응답·다른 항목 결과 재조회"]
```

- 시연 계정 사전 발급·허용 목록은 이번 작성 기준이다. 2절의 공개 가입·이메일 확인 전체 흐름을 시연할 필요는 없으며 준비된 계정의 확인 상태와 실제 로그인·접근 권한을 검증한다.
- 역할 스위치만으로 교수 권한을 부여하지 않는다. 학생과 교수는 별도 로그인 세션에서 같은 검토 데이터를 사용한다.
- 문서 AI 구성·로드맵 상세 편집 등은 기존 초기 범위를 유지하되 대표 시연 뒤로 순서를 둘 수 있다. 과거 기록·파일·차수 조회와 실패·취소 복귀는 시연에도 필요하다.
- 시연 필수 AI는 메모 정리와 수정 방안 제안이다. AI가 실패해도 직접 작성·준비를 계속하며 저장된 예시는 실제 API 응답과 구분한다.

## 1. 전체 이동

관련 기능: 1.5, 7.1과 각 작업 기능.

```mermaid
flowchart LR
  home_entry(["학생 작업 진입"]) --> home_auth["로그인·필요한 이메일 확인"]
  home_auth --> home_research{"사용할 연구가 있는가?"}
  home_research -->|없음| home_create["연구 생성"]
  home_research -->|있음| home_select["기존 연구 선택·전환"]
  home_create --> home_dashboard["현재 연구 대시보드"]
  home_select --> home_dashboard
  home_dashboard -->|미팅·기록| home_meeting["미팅 목록·상세·과거 기록"]
  home_dashboard -->|피드백| home_feedback["피드백·수정 방안"]
  home_dashboard -->|할 일·준비| home_prepare["전체 할 일·다음 미팅 준비"]
  home_dashboard -->|자료| home_files["자료·보존 버전"]
  home_dashboard -->|수정 결과·검토| home_review["개인 수정 결과·학생 검토 상세"]
  home_dashboard -->|로드맵·일정| home_roadmap["단계·마일스톤·주요 일정"]
  home_dashboard -->|연구 관리| home_archive["연구 전환·보관·복원"]
  home_archive --> home_select
  home_dashboard -->|새 응답| home_response["해당 검토 항목·차수·대화"]
  home_dashboard -.->|후속| home_later["통합 검색·전체 활동·기록 비교"]
  home_professor(["교수의 검토 링크 열기"]) --> home_access["로그인·지정 계정·공유 상태 확인"]
  home_access --> home_professor_review["공유된 검토 항목·파일·응답"]
  classDef later fill:#f5f5f5,stroke:#666,stroke-dasharray:5 5;
  class home_later later;
```

- 빈 연구에는 미팅 기록 남기기·자료 추가를 안내한다. 로드맵이나 교수 검토를 먼저 완료하게 하지 않는다.
- 연구 전환 시 자료·기록·작업·계획과 AI 선택 범위를 함께 전환한다. 보관은 기록 삭제나 공유 중지가 아니며 보관 목록에서 복원할 수 있다.
- 대시보드의 작업·질문·새 응답·일정은 각각 선택한 원래 위치로 이동한다. 교수에게 학생 연구의 전체 대시보드를 제공하지 않는다.

## 2. 로그인과 검토 링크 진입

관련 기능: 6.1~6.2.

```mermaid
flowchart TD
  auth_student(["학생 작업 열기"]) --> auth_session{"로그인되어 있는가?"}
  auth_link(["검토 링크 열기<br/>요청·항목·차수 위치 유지"]) --> auth_session
  auth_session -->|아니요| auth_login["로그인"]
  auth_login -->|계정 없음| auth_signup["가입·필요한 로그인 완료"]
  auth_signup --> auth_email
  auth_login --> auth_success{"로그인 성공?"}
  auth_success -->|실패| auth_retry["실패 안내·입력 유지"]
  auth_retry --> auth_login
  auth_success -->|성공| auth_email{"이메일 확인이 필요한가?"}
  auth_session -->|예| auth_email
  auth_email -->|예| auth_verify["이메일 확인·실패 시 재시도"]
  auth_verify -->|확인 완료| auth_purpose{"원래 진입 목적은?"}
  auth_email -->|아니요| auth_purpose
  auth_purpose -->|학생 작업| auth_workspace["연구 선택·생성 또는 현재 연구 대시보드"]
  auth_purpose -->|검토 링크| auth_owner{"요청 소유 학생인가?"}
  auth_owner -->|예| auth_student_review["학생 검토 상세<br/>공유 중지 뒤에도 자기 이력 조회"]
  auth_owner -->|아니요| auth_permission{"공유 중이며 확인된 이메일이<br/>지정 교수 주소와 일치하는가?"}
  auth_permission -->|예| auth_professor_review["원래 검토 항목·차수 열기"]
  auth_permission -->|아니요| auth_denied["내용 없는 접근 불가 안내"]
  auth_denied -->|다른 계정으로 로그인| auth_login
```

- 인증 중에도 원래 진입 목적을 유지하며 가입·이메일 확인이 끝나면 해당 위치의 권한을 다시 확인한다.
- 접근 불가 화면에는 자료 제목·발췌·파일을 노출하지 않는다. 계정 이메일 일치가 교수 신분 자체를 증명하는 것은 아니다.
- 실제 인증 수단은 운영 전 결정한다. 로그인·이메일 확인은 현재 기능명세서의 화면 기준이다.

## 3. 미팅 생성·기록 정리·결정과 질문

관련 기능: 8.1~8.4, 2.1.

```mermaid
flowchart TD
  meeting_list["미팅 목록"] -->|추가| meeting_create["이름·날짜 지정 또는 미정 선택"]
  meeting_create -->|저장| meeting_detail["미팅 상세"]
  meeting_list -->|기존 미팅 선택| meeting_detail
  meeting_detail -->|일시 변경·취소·취소 되돌리기| meeting_change["변경 저장·이력 유지"]
  meeting_change --> meeting_detail
  meeting_detail -->|기록 시작| meeting_start["기록 중으로 변경"]
  meeting_start --> meeting_memo["원문 메모 입력·붙여넣기<br/>자동 저장"]
  meeting_detail -->|메모 작성·수정| meeting_memo
  meeting_memo -->|직접 정리| meeting_edit["정리 항목 편집<br/>피드백·결정 사항·질문"]
  meeting_memo -->|AI로 정리| meeting_ai_scope["AI 영역 열기·입력 범위 확인"]
  meeting_ai_scope -->|실행| meeting_ai["선택 원문에서 후보 제안"]
  meeting_ai -->|성공| meeting_edit
  meeting_ai -->|실패·중단| meeting_manual["원문·입력 유지·직접 정리 계속"]
  meeting_manual --> meeting_edit
  meeting_edit -->|선택 항목 수정·저장| meeting_saved["원문 발췌·위치·작성 주체와 함께 저장"]
  meeting_saved -->|피드백 항목 조회| meeting_feedback["피드백 목록·상세"]
  meeting_saved -->|결정·질문 항목 조회| meeting_decisions["결정·질문 목록"]
  meeting_detail -->|결정·질문 보기| meeting_decisions
  meeting_decisions -->|직접 추가| meeting_direct["내용 입력·학생 작성으로 저장"]
  meeting_direct --> meeting_decisions
  meeting_decisions -->|질문을 미팅에 연결| meeting_target["대상 미팅 선택<br/>없으면 날짜 미정 미팅 생성"]
  meeting_target --> meeting_prepared["선택한 미팅 준비 목록에 같은 질문 연결"]
  meeting_decisions -->|질문 해결| meeting_resolved["해결 이력 유지"]
  meeting_resolved -->|다시 열기| meeting_decisions
  meeting_memo -->|기록 마무리| meeting_finish["메모 저장 상태 확인·기록 완료로 변경"]
  meeting_finish --> meeting_detail
  meeting_list -->|과거 기록 찾기| meeting_history["과거 미팅 목록<br/>일시·기록 상태·날짜 미정·취소 포함"]
  meeting_history -->|선택| meeting_detail
```

- 기록 마무리 없이도 메모를 저장하고 다른 작업을 할 수 있다. 메모 저장 실패는 입력을 유지하며 저장 성공으로 표시하지 않는다.
- 정리 한 번에 여러 유형의 항목을 저장할 수 있다. 도식의 유형별 연결은 저장한 항목을 조회하는 경로이며 별도 확정 절차가 아니다.
- 같은 발언의 기존 피드백·정리 항목이 있으면 해당 관계를 재사용한다. 직접 작성한 질문에는 없는 원문을 만들지 않는다.
- 날짜가 지나도 기록 완료로 자동 변경하지 않는다. 일시 변경·취소는 연결된 작업·자료·질문이나 개별 기한을 바꾸지 않는다. 취소된 미팅은 기본 준비 대상에서 제외한다.
- 과거 미팅의 당시 자료·준비 문서와 현재 작업 상태를 구분한다. 여러 기록의 비교·추가 AI 정리는 후속 기능이다.

## 4. 피드백과 수정 방안

관련 기능: 2.1, 2.3, 3.2.

```mermaid
flowchart TD
  feedback_list["피드백 목록"] -->|직접 추가·원문에서 가져오기| feedback_edit["내용·출처 확인·저장"]
  feedback_edit --> feedback_detail["피드백 상세"]
  feedback_list -->|기존 항목 선택| feedback_detail
  feedback_detail -->|학생 처리 상태 변경| feedback_state["상태·선택 개인 메모 저장"]
  feedback_state --> feedback_detail
  feedback_detail -->|수정 방안 보기| feedback_method["방안 작성·비교 영역"]
  feedback_method -->|직접 작성| feedback_method_edit["방법·예상 결과·필요 자료·작업 편집"]
  feedback_method -->|제안받기| feedback_ai_scope["AI 영역 열기·원문·자료 버전·구간 확인"]
  feedback_ai_scope -->|실행| feedback_ai["복수 방안·근거·새 방법·가정 표시"]
  feedback_ai -->|성공| feedback_method_edit
  feedback_ai -->|실패·중단| feedback_method
  feedback_method_edit -->|저장| feedback_method_saved["피드백에 연결된 학생 방안"]
  feedback_method_saved -->|방안만 보관·계속 편집| feedback_detail
  feedback_method_saved -->|할 일로 만들기| feedback_task["할 일 초안<br/>새 작업 또는 기존 작업 연결 선택"]
  feedback_method_saved -->|채택 취소| feedback_cancel["연결 작업을 보여주고 관계 유지·해제 선택"]
  feedback_cancel --> feedback_detail
  feedback_list -->|반복·미해결 보기| feedback_group["원문·남은 피드백·반복 묶음 조회"]
  feedback_group -->|묶음 생성·해제 저장| feedback_group_saved["관계만 변경·원본과 상태 유지"]
  feedback_group_saved --> feedback_group
  feedback_group -->|원본 선택| feedback_detail
```

- 학생 처리 상태는 처리 전·진행 중·반영 기록 있음·보류·미수정 결정이다. 작업 완료나 교수 결과가 이 상태를 대신 변경하지 않는다.
- AI 후보 저장은 실제 작업 완료·피드백 반영·교수 확인이 아니다. 직접 작성한 방안과 AI 제안의 출처를 구분한다.
- 방안을 저장해도 할 일은 자동 생성하지 않는다. 학생이 할 일로 만들기를 선택하면 5절의 초안으로 이어진다. 채택 취소도 연결 작업을 자동 삭제하지 않는다.
- 반복 묶음은 학생이 만들거나 해제한다. 비슷한 문장을 자동으로 같은 지적으로 확정하지 않는다.

## 5. 할 일과 다음 미팅 준비

관련 기능: 4.1~4.4.

```mermaid
flowchart TD
  task_list["전체 할 일 목록"] -->|직접 추가·방안에서 가져오기| task_draft["할 일 초안<br/>기존 작업 확인·새 작업 또는 기존 연결 선택"]
  task_draft -->|새 작업 저장·기존 작업 선택| task_origin{"미팅 준비에서 시작했는가?"}
  task_origin -->|예·대상 미팅 유지| prepare_link
  task_origin -->|아니요| task_detail["전체 할 일에 있는 작업 상세"]
  task_list -->|기존 작업 선택| task_detail
  task_detail -->|상태·기한 변경 후 저장| task_state["같은 작업에 반영<br/>완료·다시 진행 가능"]
  task_state --> task_detail
  task_detail -->|준비에 포함| task_target["대상 미팅 선택<br/>없으면 날짜 미정 미팅 생성"]
  prepare_entry["미팅 상세 또는 다음 미팅 요약"] -->|준비 열기| prepare_list["해당 미팅 준비 목록"]
  task_target --> prepare_list
  prepare_list -->|남은 일 보기| prepare_remaining["이전 미팅의 미완료·미배정 작업"]
  prepare_remaining -->|기존 작업 선택| prepare_link["같은 작업 연결<br/>이미 포함한 작업은 중복 추가하지 않음"]
  prepare_link --> prepare_list
  prepare_list -->|작업 새로 추가| task_draft
  prepare_list -->|순서 변경·이번 목록에서 제외| prepare_order["해당 미팅 연결만 변경·저장"]
  prepare_order --> prepare_list
  prepare_list -->|보여줄 결과·자료·막힌 이유·질문 구성| prepare_content["자료 버전·외부 참조·기존 질문 선택 또는 직접 작성"]
  prepare_content --> prepare_list
  prepare_list -->|문서 만들기·수정| prepare_editor["준비 문서 편집"]
  prepare_editor -->|직접 작성| prepare_edit["같은 본문에서 편집"]
  prepare_editor -->|AI 구성 선택| prepare_ai_scope["선택 항목·자료 범위 확인"]
  prepare_ai_scope -->|실행| prepare_ai["구성안 제안"]
  prepare_ai -->|성공| prepare_edit
  prepare_ai -->|실패·중단| prepare_editor
  prepare_edit -->|저장| prepare_saved["현재 저장본·이전 저장본을 미팅에 연결"]
  prepare_saved --> prepare_list
```

- 작업은 미팅 없이도 저장·진행·완료한다. 작업 저장 뒤 미팅에 포함할지는 선택이며 같은 미팅 안에서 시작하면 대상 미팅을 유지한다.
- 준비 목록과 준비 문서는 구분한다. 작업·자료·질문만 모아 두고 문서를 만들지 않아도 된다. 문서는 미팅ID와 본문이 있어야 저장한다.
- 재선택은 기존 작업을 재사용한다. 이전 미팅 관계·현재 기한·선택하지 않은 작업을 유지하고 준비 순서는 미팅별로 저장한다. 수동 재선택은 현재 작성 기준안이다.
- 미팅을 연기하거나 작업을 목록에서 제외해도 작업 기한은 자동 변경하지 않는다. 기한이 지난 미완료는 지연 표시이며 별도 확정 상태가 아니다.
- 작업 완료 뒤 수정 결과 작성은 선택 행동이다. 파일 등록·피드백 반영·교수 검토 없이 완료만 기록할 수 있다.
- AI 적용·확정·저장을 반복 요구하지 않는다. 직접 작성과 AI 보조 모두 같은 편집 영역에서 저장하며 문서 저장은 교수 공유가 아니다.

## 6. 자료 등록·미리보기·보존 버전

관련 기능: 1.1~1.2, 2.4, 4.3.

```mermaid
flowchart TD
  resource_list["자료 목록"] -->|추가| resource_type{"추가 방식은?"}
  resource_context["미팅 준비·수정 결과에서 자료 추가"] --> resource_type
  resource_type -->|파일| resource_upload["파일 선택·표시 이름·유형 확인<br/>업로드 진행"]
  resource_upload -->|취소| resource_cancel["업로드 취소·원래 편집 입력 유지"]
  resource_upload -->|실패| resource_retry["형식·용량·오류 안내·재시도"]
  resource_retry --> resource_upload
  resource_upload -->|성공| resource_file_saved["자료·보존 파일 버전 등록"]
  resource_file_saved --> resource_saved["등록된 자료"]
  resource_type -->|외부 링크| resource_url["이름·유형·주소 입력·저장"]
  resource_url --> resource_saved
  resource_saved --> resource_origin{"어디서 시작했는가?"}
  resource_origin -->|자료 목록| resource_detail["자료 상세"]
  resource_origin -->|미팅·수정 결과| resource_return["원래 편집 위치로 복귀·등록 자료 연결"]
  resource_return -->|연결만 실패| resource_link_retry["등록 자료 유지·연결만 재시도"]
  resource_link_retry --> resource_return
  resource_list -->|기존 자료 선택| resource_detail
  resource_detail -->|보존 파일 선택| resource_preview["PDF·PNG·JPEG 미리보기<br/>PDF 페이지·선택 버전 표시"]
  resource_preview -->|미리보기 실패| resource_preview_retry["파일 유지·미리보기 재시도·다운로드"]
  resource_preview_retry --> resource_preview
  resource_detail -->|외부 링크 선택| resource_open["주소 표시·외부 원본 열기"]
  resource_detail -->|과거 버전 선택| resource_history["당시 파일·등록 시각·제출 관계 조회"]
  resource_detail -->|새 버전 등록| resource_version["새 파일 업로드·진행 내용 저장"]
  resource_version -->|성공| resource_detail
  resource_detail -->|분류 변경·보관| resource_manage["분류·보관 상태 저장·관계 유지"]
  resource_manage --> resource_detail
```

- 보존 버전은 당시 파일을 유지한다. 같은 이름의 파일을 올려도 자동 병합하지 않고 기존 자료의 새 버전인지 별도 자료인지 선택한다.
- 미팅 제출 연결은 버전의 별도 관계다. 새 버전 등록으로 과거 미팅·검토가 참조한 버전을 바꾸지 않는다.
- 외부 URL은 과거 본문 보존·자동 동기화를 뜻하지 않는다. 문서 수정의 교수 검토에는 보존 파일·확인 위치를 연결한다.
- 파일·자료 저장과 연결 성공은 구분한다. 미리보기 실패는 파일 저장 실패가 아니며 등록·연결 취소가 원본 삭제를 뜻하지 않는다.

## 7. 개인 수정 결과와 처리 기록

관련 기능: 2.1, 2.4.

```mermaid
flowchart TD
  result_entry["작업 또는 피드백 상세"] -->|수정 결과 정리| result_editor["제목·실제 처리 설명<br/>연결할 작업·피드백 선택"]
  result_editor -->|문서 수정| result_file["보존 파일·확인 위치 연결<br/>개인 결과는 파일 없이 저장 가능"]
  result_editor -->|비문서 작업| result_evidence["처리 설명·관련 자료·미팅 결정 연결"]
  result_file --> result_save["결과 저장"]
  result_evidence --> result_save
  result_save -->|성공| result_detail["개인 수정 결과 상세<br/>문서 검토 근거 부족 여부 표시"]
  result_save -->|실패| result_retry["설명·선택·마지막 저장 값 유지"]
  result_retry --> result_editor
  result_detail -->|개인 기록 유지| result_continue["다른 작업 계속"]
  result_detail -->|교수 검토 준비 선택| result_review["8절 검토 구성"]
  result_detail -->|작업 완료를 별도로 기록| result_task_state["선택 작업 상태 저장"]
  result_detail -->|피드백 처리 상태를 별도로 변경| result_feedback_state["선택 피드백 상태 저장"]
  result_task_state --> result_detail
  result_feedback_state --> result_detail
```

- 실제 수행한 내용만 결과로 남긴다. 결과 저장은 교수 공유·작업 완료·학생 반영 상태를 자동 변경하지 않는다.
- 개인 결과는 보존 파일 없이 저장할 수 있으나 문서 수정 검토 근거가 부족함을 표시한다. 검토 링크 생성 조건은 8절에서 확인한다.
- 같은 결과와 파일을 여러 피드백·작업·검토 항목의 근거로 재사용한다. 이미 공유한 차수의 설명·파일은 개인 결과 편집으로 바뀌지 않는다.

## 8. 검토 구성·공개 미리보기·링크 전달

관련 기능: 1.3, 6.1.

```mermaid
flowchart TD
  share_result["저장된 수정 결과 상세"] -->|교수 검토 준비| share_editor["요청 제목·교수 이메일 입력<br/>여러 수정 결과 선택"]
  share_editor --> share_items["항목별 설명·근거·확인 위치 검토"]
  share_items --> share_preview["교수 공개 미리보기<br/>본문·원 피드백·첨부 파일 전체"]
  share_preview -->|수정| share_editor
  share_preview -->|링크 생성 선택| share_valid{"필수 설명·교수 이메일·근거가 있고<br/>문서 수정의 보존 파일·위치가 준비됐는가?"}
  share_valid -->|아니요·업로드 중| share_missing["부족 항목 안내·준비 내용 유지"]
  share_missing --> share_editor
  share_valid -->|예| share_create["요청·항목별 차수·당시 내용 고정<br/>공유 중으로 저장·링크 생성"]
  share_create -->|실패| share_preview
  share_create -->|성공| share_detail["학생 검토 상세"]
  share_detail -->|링크 복사| share_copy["복사 결과 표시"]
  share_copy -->|학생이 외부에서 직접 전달| share_external["교수에게 링크 전달"]
  share_external -->|교수가 링크 열기| share_auth["2절 로그인·접근 확인"]
  share_detail -->|현재·이전 항목·응답 조회| share_round["선택 항목·차수·댓글 위치"]
  share_round --> share_detail
  share_detail -->|공유 설정·재확인 요청| share_manage["10절 기존 검토 관리"]
  share_existing["피드백·수정 결과·새 응답에서 기존 검토 열기"] --> share_detail
```

- 링크 생성은 실제 전달·열람·응답과 다르다. 복사 성공도 전달 완료로 표시하지 않는다.
- 미리보기에는 교수에게 공개할 내용을 표시한다. 개인 메모·전체 작업 목록·미채택 AI 후보는 자동 포함하지 않는다. 개인 원문의 전체 열람 권한도 자동 부여하지 않는다.
- 확인 위치를 지정해도 허용 교수는 첨부 파일 전체를 열람·다운로드한다. 일부만 공개하려면 학생이 그 부분으로 만든 별도 파일을 선택한다.
- 준비 중인 요청은 편집한다. 공유 중인 항목의 설명·근거 변경은 10절 재확인 요청으로 새 차수를 만든다. 수정 전 방향을 묻는 별도 질문 입력은 두지 않는다.

## 9. 교수의 항목별 응답과 학생의 후속 행동

관련 기능: 2.2, 7.2.

```mermaid
flowchart TD
  response_entry["허용된 교수의 검토 진입"] --> response_item["특정 항목·차수의 당시 설명·파일·위치 읽기"]
  response_item -->|항목별 결과 선택| response_choice{"어떤 결과인가?"}
  response_choice -->|수정 내용 확인| response_confirm["댓글 선택"]
  response_choice -->|추가 수정 필요| response_reason["같은 항목에서 이유 댓글 필수 입력"]
  response_confirm --> response_validate{"필수 입력과 현재 접근 권한이 유효한가?"}
  response_reason --> response_validate
  response_validate -->|입력 부족| response_input_error["입력 유지·부족 조건 안내"]
  response_input_error --> response_choice
  response_validate -->|접근 불가| response_denied["저장 거부·접근 불가 안내"]
  response_validate -->|예| response_save["해당 항목·차수의 결과와 필요한 이유 함께 저장"]
  response_save -->|실패| response_save_error["입력 유지·같은 위치에서 재시도"]
  response_save_error --> response_validate
  response_save -->|성공| response_saved["항목·차수에 결과·이유·작성자·시각 표시"]
  response_item -->|결과 선택 없이 댓글·답글| response_comment["대화 입력·현재 권한 확인·저장"]
  response_comment -->|성공| response_thread["해당 항목·차수 대화"]
  response_thread -->|해결·다시 열기| response_thread_state["대화 상태만 저장"]
  response_thread_state --> response_thread
  response_saved --> response_unread["학생에게 새 응답 표시"]
  response_comment -->|교수 댓글·답글 저장 성공| response_unread
  response_unread -->|학생이 열기| response_student["학생 검토 상세의 해당 항목·차수·댓글<br/>계정별 읽음 기록"]
  response_student_entry["학생이 기존 검토 항목·대화 열기"] --> response_student
  response_student -->|답글| response_student_reply["답글 저장·교수에게 새 표시"]
  response_student -->|필요한 행동 선택| response_next["작업 생성·수정 또는 실제 수정 뒤 재확인 요청"]
```

- 추가 수정 필요는 이유 댓글이 공백이면 저장하지 않는다. 수정 내용 확인의 댓글은 선택이다. 결과·필수 이유의 저장이 모두 성공해야 결과 저장 완료로 표시한다.
- 일반 댓글·답글은 결과를 선택하지 않아도 저장한다. 댓글 해결·다시 열기는 교수 결과·학생 처리 상태·작업 상태를 바꾸지 않는다.
- 교수 응답은 해당 항목·차수에만 적용한다. 다른 항목을 응답 완료로 바꾸지 않으며 학생은 교수 결과를 대신 입력·수정하지 못한다.
- 교수는 본인 결과 수정 이력을 남긴다. 추가 수정 필요의 필수 이유를 지우려면 대체 이유가 필요하다.
- 학생은 응답을 읽고 다음 행동을 선택한다. 읽음은 이해·반영·교수 확인이 아니며 추가 수정 필요도 과거 학생 반영 이력을 지우지 않는다.

## 10. 항목별 재확인과 공유 설정

관련 기능: 2.5, 6.1.

```mermaid
flowchart TD
  recheck_detail["학생의 기존 검토 상세"] -->|재확인 요청| recheck_item["이전에 공유한 항목 중 다시 보낼 항목 선택"]
  recheck_item --> recheck_edit["실제 새 수정 결과·설명·근거·위치 확인"]
  recheck_edit --> recheck_preview["새 차수 공개 미리보기"]
  recheck_preview -->|취소| recheck_cancel["새 차수 만들지 않음·기존 검토 유지"]
  recheck_cancel --> recheck_detail
  recheck_preview -->|재확인 요청 저장| recheck_save["선택 항목에만 새 차수 저장"]
  recheck_save -->|실패| recheck_preview
  recheck_save -->|성공| recheck_latest["기존 검토 상세의 선택 항목·최신 차수<br/>새 결과는 응답 전"]
  recheck_latest -->|이전 차수 선택| recheck_history["당시 설명·파일·교수 응답 조회"]
  recheck_history --> recheck_latest
  recheck_detail -->|공유 설정| access_settings["현재 허용 이메일·공유 상태"]
  access_settings -->|허용 주소 변경| access_email["새 주소 입력·변경 전후 확인·저장"]
  access_settings -->|공유 중지| access_stop["이후 교수 접근 중지·학생 이력 유지"]
  access_settings -->|다시 공유| access_resume["허용 계정 재확인·공유 상태 저장"]
  access_email -->|성공| access_settings
  access_stop -->|성공| access_settings
  access_resume -->|성공| access_settings
  access_email -->|실패| access_failure["기존 설정·입력 유지·재시도"]
  access_resume -->|실패| access_failure
  access_stop -->|실패| access_failure
  access_failure --> access_settings
```

- 새 파일 등록·개인 결과 편집만으로 재확인 차수를 만들지 않는다. 이전 자료·설명·응답과 변경하지 않은 다른 항목의 교수 결과는 유지한다.
- 같은 링크에서 최신·이전 차수를 여는 것은 현재 작성 기준안이다. 새 요청을 자동 생성하거나 전체 항목을 응답 전으로 되돌리지 않는다.
- 이전 차수에서 늦게 저장한 응답은 그 차수에 연결하고 최신 차수의 결과를 덮어쓰지 않는다.
- 재확인 차수와 공유 상태는 구분한다. 공유가 중지된 요청은 새 차수 저장만으로 교수 접근을 다시 허용하지 않는다.
- 주소 변경·공유 중지 뒤에는 이미 열린 화면에서도 파일 열기·다운로드·댓글·응답 저장 시 현재 권한을 다시 확인한다. 이전 응답의 작성자와 당시 자료는 유지한다.
- 공유 중지는 보관·영구 삭제와 다르며 이미 내려받은 사본까지 회수하지 않는다.

## 11. 로드맵과 주요 일정 직접 관리

관련 기능: 5.1~5.2.

```mermaid
flowchart TD
  roadmap_entry["로드맵"] --> roadmap_list["단계·마일스톤 목록"]
  roadmap_list -->|추가·상세 편집| roadmap_edit["이름·목표·완료 기준·예정일·상태 입력"]
  roadmap_edit -->|저장| roadmap_detail["단계·마일스톤 상세"]
  roadmap_detail -->|연결| roadmap_links["자료·작업·피드백 선택·관계 저장"]
  roadmap_links --> roadmap_detail
  roadmap_detail -->|상태·대표 집중 단계·일정 변경| roadmap_change["변경 저장·이력 유지"]
  roadmap_change --> roadmap_detail
  roadmap_entry -->|일정 추가| deadline_edit["이름·유형·외부 마감 또는 개인 목표<br/>확정 또는 날짜 조사 중 입력"]
  deadline_edit --> deadline_fixed{"확정 일정인가?"}
  deadline_fixed -->|예| deadline_date["날짜 필수<br/>외부 확정 마감이면 출처 필수"]
  deadline_fixed -->|아니요| deadline_pending["날짜 조사 중으로 저장 준비"]
  deadline_date --> deadline_optional["시각 선택·입력 시 시간대<br/>단계·마일스톤 선택 연결"]
  deadline_pending --> deadline_optional
  deadline_optional -->|입력 확인·저장| deadline_detail["주요 일정 상세·출처·확정 여부"]
  deadline_detail -->|수정·삭제| deadline_change["현재 일정 반영·변경 이력"]
  deadline_change --> roadmap_entry
  roadmap_summary["대시보드의 가까운 마감 선택"] --> deadline_detail
```

- 단계·마일스톤의 준비 전·진행 중·완료는 학생이 직접 관리한다. 여러 단계의 작업을 병행하거나 완료 후 다시 진행할 수 있다.
- 작업 완료 개수·가이드 확인·교수 결과로 연구 단계를 자동 완료하지 않는다. 종료 예정일이 시작 예정일보다 이른 구간은 저장하지 않는다.
- 날짜 조사 중 저장은 현재 작성 기준안이다. 시각이 없으면 시각 미확인으로 표시하고 23:59를 채우지 않는다. 시각을 입력하면 시간대를 함께 기록한다.
- 개인 목표일 변경으로 공식 마감을 바꾸지 않는다. 일정 저장은 다른 단계·작업 기한을 자동 변경하지 않는다.
- 단계 상세·직접 편집은 초기 기능이다. 준비 가이드와 일정 역산·재조정은 13절 후속 범위다.

## 12. 기본 목록 찾기와 새 응답 표시

관련 기능: 7.1~7.2.

```mermaid
flowchart TD
  find_student["학생의 현재 연구"] --> find_list["자료·미팅·피드백·할 일 기본 목록"]
  find_list -->|이름·날짜·상태 조건 입력·해제| find_results["현재 조건의 목록"]
  find_results -->|결과 선택| find_original["해당 유형의 원래 기록"]
  find_results -->|0건| find_empty["대상 없음·필터 해제 안내"]
  find_results -->|조회 실패| find_error["조건 유지·재시도"]
  find_empty --> find_list
  find_error --> find_results
  find_student -->|새 교수 응답| find_student_updates["허용된 검토 항목·차수·댓글 위치"]
  find_professor["교수의 허용된 검토"] -->|새 차수·학생 답글| find_professor_updates["그 검토 안의 항목·차수·대화 위치"]
  find_student_updates -->|열기| find_read["계정별 읽음 기록"]
  find_professor_updates -->|열기| find_read
```

- 학생의 새 응답은 학생 검토 상세로, 교수의 새 표시는 허용된 검토 안으로 이동한다. 교수에게 학생 대시보드나 연구 전체 알림을 노출하지 않는다.
- 남은 작업 요약은 해당 작업·준비 목록, 질문 요약은 해당 질문·미팅, 가까운 마감은 해당 일정 상세를 연다.
- 알림 목록을 별도 화면으로 둘지는 작성 기준안이다. 초기 요구는 서비스 안의 새 표시와 정확한 대상 위치 이동이다.
- 읽음은 반영·작업 완료·교수 확인을 바꾸지 않는다. 현재 권한이 없는 제목·발췌·건수는 목록과 새 표시에서도 노출하지 않는다.

## 13. 후속 기능

관련 기능: 1.4, 3.1, 5.3~5.4, 8.5. 아래 점선 경로는 초기 사용의 선행조건이 아니다.

```mermaid
flowchart LR
  later_student["학생 연구"] -.-> later_search["통합 검색·유형별 결과"]
  later_search -.->|선택| later_original["선택 결과 유형의 원래 기록·버전"]
  later_student -.-> later_activity["전체 활동·종류·날짜 필터"]
  later_activity -.->|선택| later_original
  later_student -.-> later_compare["기록·자료 버전 선택·직접 비교"]
  later_compare -.->|원문 열기| later_original
  later_compare -.->|선택적 AI| later_ai["처리 범위 확인·추가 정리"]
  later_ai -.->|편집·별도 저장| later_summary["원문과 연결된 정리본"]
  later_stage["단계 상세"] -.-> later_guide["준비 가이드·항목 확인"]
  later_guide -.->|확인 상태만 저장| later_stage
  later_deadline["대상 마감·단계·남은 작업"] -.-> later_plan["기간·검토 여유·가정 확인<br/>기존 일정과 제안 비교"]
  later_plan -.->|고쳐 명시적으로 적용| later_apply["선택 일정 변경·전후 이력"]
  later_plan -.->|취소| later_keep["기존 계획 유지"]
  later_meeting["정책이 확정된 대상 미팅"] -.-> later_audio["필요 동의 확인·음성 녹음 또는 등록"]
  later_audio -.-> later_transcript["전사·음성 구간 대조·학생 정정"]
  later_transcript -.->|선택해 활용| later_memo["기존 메모를 덮어쓰지 않고 정리에 활용"]
  classDef later fill:#f5f5f5,stroke:#666,stroke-dasharray:5 5;
  class later_search,later_original,later_activity,later_compare,later_ai,later_summary,later_guide,later_plan,later_apply,later_keep,later_audio,later_transcript,later_memo later;
```

| 기능 | 유지할 동작·예외 |
|---|---|
| 통합 검색·전체 활동 | 현재 권한으로 제목·메타정보·기록을 조회하고 선택한 원래 유형으로 이동한다. 파일 본문 OCR·외부 URL 본문 수집은 검색 대상에 넣지 않는다. 검색 결과 없음·활동 없음·조회 실패를 구분한다. 교수에게 연구 전체 활동을 공개하지 않는다. |
| 기록 비교·추가 AI 정리 | 직접 비교만 해도 된다. AI 실행 때만 처리 범위를 확인하고 실패해도 직접 비교·입력을 유지한다. 저장한 정리본은 원문을 바꾸지 않으며 각 원본 버전으로 이동한다. |
| 준비 가이드 | 해당 단계의 안내·학생 확인을 저장한다. 확인 표시가 연구 단계 완료는 아니다. |
| 일정 역산·재조정 | 예상 기간·가정·부족 기간을 표시한다. 적용 전에는 현재 계획을 바꾸지 않으며 공식 마감은 자동 이동하지 않는다. 일부 적용 실패 시 기존 계획을 복구하거나 미적용 상태를 유지한다. |
| 녹음·전사 | 동의·보존·삭제·외부 처리 정책이 확정된 뒤 제공한다. 거부·파일 오류·전사 실패에도 직접 메모를 계속한다. 부분 전사·학생 정정·화자 추정을 구분하며 교수 직접 확인으로 표현하지 않는다. |

## 예외 상황 (메인 시나리오 기준)
> 2026-11-16 추가. 메인 시나리오([PRD](prd.md#메인-시나리오-사용성-테스트-과업))를 한 단계씩 따라가며 계획대로 진행되지 않는 경우와 화면이 알려 줄 다음 행동을 정한다.

| 단계 | 상황 | 화면에 보여 줄 것 | 다음 행동 |
| --- | --- | --- | --- |
| 미팅 메모에서 피드백 고르기 | 빈 상태: 메모가 없는 미팅 | “아직 기록이 없어요”와 기록 방법 | 메모 쓰기 · 녹음하기 |
| 기록 불러오기 | 오류: 서버·네트워크 문제로 실패 | “기록을 불러오지 못했어요” (빈 상태와 다른 화면) | 다시 불러오기 |
| 수정 방법 정하기 | 로딩: AI 제안이 10초 넘게 걸림 | 지금 단계, 지난 시간과 보통 걸리는 시간, 화면을 떠나도 계속되는지 | 기다리기 · 중단 · 직접 작성 |
| 수정 방법 정하기 | AI 오류: 그럴듯하지만 원문과 다른 제안 | 원문 인용과 ‘확인이 필요한 가정’을 나눠 표시, 인용이 원문에 없으면 적용하지 않음 | 그 자리에서 고치기 · 다시 제안받기 · 직접 작성 |
| 수정 방법 정하기 | AI 미연결 | “연구 도우미가 아직 연결되지 않았어요” (가짜 결과 없음) | 직접 작성 |
| 할 일로 만들기 | 입력 오류: 이름이 비어 있음 | 칸 바로 아래 이유, 그 칸으로 초점 이동 | 이름 쓰기 |
| 수정 결과 기록 | 업로드 실패·중단 | 실제 진행률, 실패 이유 | 다시 시도 |
| 검토 요청 만들기 | 보낼 수정 결과가 없음 | 빈 상태와 수정 결과 만들기 안내 | 수정 결과 만들기 |
| 링크 만들기 | 요청 실패 | 실패 이유, 입력은 그대로 | 다시 시도 |

버튼 이름 기준: 불러오기에 실패하면 ‘다시 불러오기’, 사용자가 한 요청이 실패하면 ‘다시 시도’.

## 14. 공통 저장·취소·실패 처리

관련 기능: 기능명세서의 프로덕트 정책.

| 상황 | 처리 |
|---|---|
| 필수 입력 없음·공백 | 저장하지 않고 해당 입력을 안내한다. 선택 입력은 비워도 저장한다. |
| 메모 작성 | 자동 저장하며 저장 중·저장됨·실패를 표시한다. |
| 작업·수정 결과·교수 응답·권한 변경 | 명시적 저장 성공 뒤 현재 상세·목록에 반영한다. |
| 저장 실패 | 입력과 마지막 저장 값을 유지한다. 같은 위치에서 재시도하며 성공으로 표시하지 않는다. |
| 저장 성공·연결 실패 | 원본은 유지하고 연결만 재시도한다. 중복 선택·재시도로 같은 기록을 여러 개 만들지 않는다. |
| 미저장 입력을 두고 이동 | 계속 편집 또는 버리고 이동을 선택하게 한다. 자동 저장 실패를 조용히 무시하지 않는다. |
| 다른 창에서 변경 | 알리지 않고 덮어쓰지 않으며 최신 상태와 미저장 입력을 확인한다. |
| 권한 변경 | 화면·파일 열기·다운로드·댓글·응답 저장 때 현재 권한을 확인한다. |
| AI 실행 | 선택한 메모·자료 버전·구간을 실행 전에 보여준다. 교수 공유 동의와 구분한다. |
| AI 실패·생성 중단 | 원문·학생 입력·기존 작업을 유지하고 직접 작성을 계속한다. 외부에서 이미 처리한 내용까지 소급 취소했다고 표현하지 않는다. |
| AI 영역 닫기 | 입력·후보를 유지한다. 생성 중단과 별도 행동으로 취급한다. |
| AI 방안 채택 취소 | 연결 작업·수정 결과를 자동 삭제하지 않고 기존 관계 유지·해제를 선택한다. |
| 조회 | 대상 없음·검색 결과 없음·불러오기 실패·접근 불가를 구분한다. |

작업 완료, 학생의 피드백 처리 상태, 교수의 항목별 결과, 질문 해결, 댓글 대화 해결, 읽음은 각각 별도 기록이다. 한 상태를 변경했다고 다른 상태를 자동 변경하지 않는다.
