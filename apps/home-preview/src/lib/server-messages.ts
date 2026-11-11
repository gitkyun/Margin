import { t } from "@/lib/i18n";

/**
 * Server-side messages (DB functions and Edge Functions) are written in the
 * old 합니다체 and older terms. The server is unchanged; this maps each known
 * message to the wording in docs/design/ux-writing.md before it is shown.
 * Add new server messages here when you add them on the server.
 * Generated from the migrations and functions on 2026-11-09.
 * The tables keep the Korean wording; `t()` is applied where the message is
 * returned, so each display value is also a key in `src/i18n/ja/server.ts`
 * (checked by tests/server-messages-ja.test.ts).
 */
export const EXACT: Record<string, string> = {
  // i18n-ignore
  "AI 발췌를 원문에서 찾을 수 없어 후보를 적용하지 않았습니다. 다시 시도하거나 직접 작성해 주세요.":
    "AI가 발췌한 내용을 원문에서 찾을 수 없어 AI 제안을 적용하지 않았어요. 다시 시도하거나 직접 작성해 주세요.", // i18n-ignore
  // i18n-ignore
  "AI 사용 한도에 도달했습니다. 잠시 뒤 다시 시도하거나 직접 작성해 주세요.":
    "AI 사용 한도에 도달했어요. 잠시 뒤 다시 시도하거나 직접 작성해 주세요.", // i18n-ignore
  // i18n-ignore
  "AI 사용 한도에 도달했습니다. 잠시 뒤 다시 시도해 주세요.":
    "AI 사용 한도에 도달했어요. 잠시 뒤 다시 시도해 주세요.", // i18n-ignore
  // i18n-ignore
  "AI 수정 방안의 작업 목록을 확인할 수 없습니다.":
    "AI가 제안한 수정 방법의 할 일 목록을 확인할 수 없어요.", // i18n-ignore
  "AI 실행 권한이 없습니다.": "AI를 실행할 권한이 없어요.", // i18n-ignore
  // i18n-ignore
  "AI 실행 중 문제가 발생했습니다. 작성한 내용은 유지됩니다.":
    "AI 실행 중 문제가 생겼어요. 작성한 내용은 그대로 있어요.", // i18n-ignore
  // i18n-ignore
  "AI 실행을 준비하지 못했습니다. 잠시 뒤 다시 시도해 주세요.":
    "AI 실행을 준비하지 못했어요. 잠시 뒤 다시 시도해 주세요.", // i18n-ignore
  "AI 실행을 중단했습니다.": "AI 실행을 중단했어요.", // i18n-ignore
  // i18n-ignore
  "AI 응답 형식을 확인할 수 없습니다. 다시 시도하거나 직접 작성해 주세요.":
    "AI 응답 형식을 확인할 수 없어요. 다시 시도하거나 직접 작성해 주세요.", // i18n-ignore
  // i18n-ignore
  "AI 응답 형식을 확인할 수 없습니다. 입력은 유지됩니다.":
    "AI 응답 형식을 확인할 수 없어요. 입력한 내용은 그대로 있어요.", // i18n-ignore
  "AI 응답을 받지 못했습니다.": "AI 응답을 받지 못했어요.", // i18n-ignore
  // i18n-ignore
  "AI 응답을 받지 못했습니다. 입력은 유지됩니다. 다시 시도하거나 직접 작성해 주세요.":
    "AI 응답을 받지 못했어요. 입력한 내용은 그대로 있어요. 다시 시도하거나 직접 작성해 주세요.", // i18n-ignore
  // i18n-ignore
  "AI 응답이 늦어 중단했습니다. 입력을 유지한 채 다시 시도하거나 직접 작성해 주세요.":
    "AI 응답이 늦어 중단했어요. 입력한 내용 그대로 다시 시도하거나 직접 작성해 주세요.", // i18n-ignore
  // i18n-ignore
  "AI가 사용할 수 있는 후보를 반환하지 않았습니다. 직접 작성하거나 다시 시도해 주세요.":
    "사용할 수 있는 AI 제안을 받지 못했어요. 직접 작성하거나 다시 시도해 주세요.", // i18n-ignore
  // i18n-ignore
  "AI가 후보를 반환하지 않았습니다. 직접 작성하거나 입력을 확인해 다시 시도해 주세요.":
    "AI 응답이 비어 있어요. 직접 작성하거나 입력을 확인해 다시 시도해 주세요.", // i18n-ignore
  "PDF·TXT·MD를 첨부해 주세요.": "PDF, TXT, MD 파일을 첨부해 주세요.", // i18n-ignore
  // i18n-ignore
  "http 또는 https 외부 주소를 입력해 주세요.":
    "http 또는 https로 시작하는 링크를 입력해 주세요.", // i18n-ignore
  // i18n-ignore
  "같은 내용의 AI 처리가 진행 중입니다.":
    "같은 내용으로 AI를 실행하는 중이에요.", // i18n-ignore
  // i18n-ignore
  "같은 수정 결과를 중복 선택할 수 없습니다.":
    "같은 수정 결과를 중복 선택할 수 없어요.", // i18n-ignore
  // i18n-ignore
  "같은 요청 번호를 다른 입력에 사용할 수 없습니다.":
    "같은 요청 번호를 다른 입력에 사용할 수 없어요.", // i18n-ignore
  "같은 원문의 AI 처리가 진행 중입니다.": "같은 원문으로 AI가 실행 중이에요.", // i18n-ignore
  // i18n-ignore
  "검토 이력에 사용한 기록은 삭제할 수 없습니다.":
    "검토 이력에 사용한 기록은 삭제할 수 없어요.", // i18n-ignore
  "공유 설정을 변경할 수 없습니다.": "공유 설정을 변경할 수 없어요.", // i18n-ignore
  // i18n-ignore
  "공유 중인 검토에서 재확인을 요청해 주세요.":
    "공유 중인 검토 요청에서만 다시 확인을 요청할 수 있어요.", // i18n-ignore
  // i18n-ignore
  "근거 파일을 찾을 수 없습니다. 파일을 확인해 주세요.":
    "연결한 파일을 찾을 수 없어요. 파일을 확인해 주세요.", // i18n-ignore
  "기록 용량이 너무 큽니다.": "기록 용량이 너무 커요.", // i18n-ignore
  // i18n-ignore
  "기록 하나와 2000자 이내의 질문을 선택해 주세요.":
    "기록 하나를 선택하고 질문을 2000자 이내로 입력해 주세요.", // i18n-ignore
  // i18n-ignore
  "기록은 삭제했지만 파일 정리가 끝나지 않았습니다. 휴지통에서 다시 시도해 주세요.":
    "기록은 삭제했지만 파일 삭제가 끝나지 않았어요. 휴지통에서 다시 시도해 주세요.", // i18n-ignore
  "내 AI 결과만 채택할 수 있습니다.": "내 AI 제안만 선택할 수 있어요.", // i18n-ignore
  // i18n-ignore
  "내 녹음에만 전사문을 저장할 수 있습니다.":
    "내 녹음에만 전사문을 저장할 수 있어요.", // i18n-ignore
  "내 실행만 중단할 수 있습니다.": "내가 시작한 실행만 중단할 수 있어요.", // i18n-ignore
  // i18n-ignore
  "다른 기록에 연결되어 있습니다. 연결을 먼저 정리해 주세요.":
    "다른 기록에 연결되어 있어요. 연결을 먼저 정리해 주세요.", // i18n-ignore
  // i18n-ignore
  "다른 연구의 기록으로 바꿀 수 없습니다.":
    "다른 연구의 기록으로 바꿀 수 없어요.", // i18n-ignore
  // i18n-ignore
  "다른 연구의 질문을 연결할 수 없습니다.":
    "다른 연구의 질문을 연결할 수 없어요.", // i18n-ignore
  // i18n-ignore
  "다른 창에서 기록이 변경되었습니다. 작성 내용을 유지하고 새로 불러와 주세요.":
    "다른 창에서 기록이 바뀌었어요. 작성 내용을 유지하고 새로 불러와 주세요.", // i18n-ignore
  // i18n-ignore
  "다른 창에서 연구가 변경되었습니다. 새로 불러온 뒤 다시 저장해 주세요.":
    "다른 창에서 연구가 바뀌었어요. 새로 불러온 뒤 다시 저장해 주세요.", // i18n-ignore
  // i18n-ignore
  "다른 창에서 전사문을 수정했습니다. 작성한 글을 보관한 뒤 최신본과 비교해 주세요.":
    "다른 창에서 전사문을 수정했어요. 지금 쓴 내용을 복사해 둔 뒤 최신 저장본과 비교해 주세요.", // i18n-ignore
  "단계 상태·순서를 확인해 주세요.": "단계 상태와 순서를 확인해 주세요.", // i18n-ignore
  // i18n-ignore
  "등록된 교수 시연 계정의 이메일을 입력해 주세요.":
    "아직 마진에 가입하지 않은 이메일이에요. 초대 링크를 보내 가입을 부탁해 주세요.", // i18n-ignore
  // i18n-ignore
  "로그인 시간이 만료되었습니다. 다시 로그인해 주세요.":
    "로그인이 만료됐어요. 다시 로그인해 주세요.", // i18n-ignore
  // i18n-ignore
  "문서 수정 항목에는 보존 파일과 확인 위치가 필요합니다.":
    "문서 수정 항목에는 파일과 볼 위치가 필요해요.", // i18n-ignore
  // i18n-ignore
  "미팅이 변경되었습니다. 작성 내용을 유지하고 다시 불러와 주세요.":
    "미팅 내용이 바뀌었어요. 작성 내용을 유지하고 다시 불러와 주세요.", // i18n-ignore
  "방안의 원문 발췌를 확인해 주세요.": "수정 방법의 원문 발췌를 확인해 주세요.", // i18n-ignore
  "보존 버전은 삭제할 수 없습니다.": "버전은 삭제할 수 없어요.", // i18n-ignore
  // i18n-ignore
  "보존 파일은 덮어쓸 수 없습니다. 새 버전을 추가해 주세요.":
    "파일은 덮어쓸 수 없어요. 새 버전을 추가해 주세요.", // i18n-ignore
  // i18n-ignore
  "본인 계정을 검토 대상으로 지정할 수 없습니다.":
    "본인 계정을 검토 대상으로 지정할 수 없어요.", // i18n-ignore
  // i18n-ignore
  "삭제 완료를 확인하지 못했습니다. 다시 시도해 주세요.":
    "삭제 완료를 확인하지 못했어요. 다시 시도해 주세요.", // i18n-ignore
  // i18n-ignore
  "삭제를 완료하지 못했습니다. 다시 시도해 주세요.":
    "삭제를 완료하지 못했어요. 다시 시도해 주세요.", // i18n-ignore
  // i18n-ignore
  "새 검토 차수가 있습니다. 최신 차수에서 응답해 주세요.":
    "학생이 이 항목의 다시 확인을 요청해 새 검토가 생겼어요. 작성한 내용을 복사해 둔 뒤 최신 검토에서 응답해 주세요.", // i18n-ignore
  // i18n-ignore
  "생성자 또는 연구 소유자만 확정할 수 있습니다.":
    "일정을 만든 사람이나 연구 소유자만 확정할 수 있어요.", // i18n-ignore
  "소유자는 해제할 수 없습니다.": "소유자의 접근은 해제할 수 없어요.", // i18n-ignore
  "소유자만 삭제할 수 있습니다.": "소유자만 삭제할 수 있어요.", // i18n-ignore
  // i18n-ignore
  "소유자만 연구를 보관·삭제·복원할 수 있습니다.":
    "소유자만 연구를 보관, 삭제, 복원할 수 있어요.", // i18n-ignore
  "수정 방안 입력을 확인해 주세요.": "수정 방법 입력을 확인해 주세요.", // i18n-ignore
  "시간 응답 권한이 없습니다.": "시간 응답 권한이 없어요.", // i18n-ignore
  "업로드 경로·용량을 확인해 주세요.": "업로드 경로와 용량을 확인해 주세요.", // i18n-ignore
  "연결할 기록을 찾을 수 없습니다.": "연결할 기록을 찾을 수 없어요.", // i18n-ignore
  // i18n-ignore
  "연구 도우미에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요. 직접 작성한 내용은 유지됩니다.":
    "연구 도우미에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요. 직접 작성한 내용은 그대로 있어요.", // i18n-ignore
  // i18n-ignore
  "연구 소유자만 참여자를 관리할 수 있습니다.":
    "연구 소유자만 참여자를 관리할 수 있어요.", // i18n-ignore
  "연구 식별자가 필요합니다.": "어떤 연구인지 알 수 없어요.", // i18n-ignore
  "연구 접근 권한이 없습니다.": "이 연구에 접근할 권한이 없어요.", // i18n-ignore
  // i18n-ignore
  "연구가 변경되었습니다. 최신 내용을 확인해 주세요.":
    "연구가 바뀌었어요. 최신 내용을 확인해 주세요.", // i18n-ignore
  // i18n-ignore
  "원문이 너무 깁니다. 범위를 줄여 주세요.":
    "원문이 너무 길어요. 범위를 줄여 주세요.", // i18n-ignore
  // i18n-ignore
  "원문이 변경되었거나 발췌를 찾을 수 없습니다. 원문을 다시 선택해 주세요.":
    "원문이 바뀌었거나 발췌한 부분을 찾을 수 없어요. 원문을 다시 선택해 주세요.", // i18n-ignore
  // i18n-ignore
  "원문이 변경되었습니다. 저장한 내용을 다시 불러온 뒤 AI를 실행해 주세요.":
    "원문이 바뀌었어요. 저장한 내용을 다시 불러온 뒤 AI를 실행해 주세요.", // i18n-ignore
  "유효한 초대를 찾을 수 없습니다.": "유효한 초대를 찾을 수 없어요.", // i18n-ignore
  "이 검토를 변경할 수 없습니다.": "이 검토를 변경할 수 없어요.", // i18n-ignore
  "이 검토에 응답할 수 없습니다.": "이 검토에 응답할 수 없어요.", // i18n-ignore
  "이 검토에 접근할 수 없습니다.": "이 검토에 접근할 수 없어요.", // i18n-ignore
  "이 기록에 접근할 수 없습니다.": "이 기록에 접근할 수 없어요.", // i18n-ignore
  "이 기록을 변경할 수 없습니다.": "이 기록을 변경할 수 없어요.", // i18n-ignore
  "이 기록의 AI를 실행할 수 없습니다.": "이 기록에서 AI를 실행할 수 없어요.", // i18n-ignore
  "이 대화를 변경할 수 없습니다.": "이 대화를 변경할 수 없어요.", // i18n-ignore
  "이 대화에 접근할 수 없습니다.": "이 대화에 접근할 수 없어요.", // i18n-ignore
  "이 미팅을 변경할 수 없습니다.": "이 미팅을 변경할 수 없어요.", // i18n-ignore
  "이 연구를 공유할 수 없습니다.": "이 연구를 공유할 수 없어요.", // i18n-ignore
  "이 연구를 변경할 수 없습니다.": "이 연구를 변경할 수 없어요.", // i18n-ignore
  // i18n-ignore
  "이 연구의 검토 요청을 준비할 수 없습니다.":
    "이 연구의 검토 요청을 준비할 수 없어요.", // i18n-ignore
  "이미 실행한 요청입니다.": "이미 실행한 요청이에요.", // i18n-ignore
  "이미 연구 소유자입니다.": "이미 연구 소유자예요.", // i18n-ignore
  // i18n-ignore
  "이미 초대했거나 참여 중인 계정입니다.":
    "이미 초대했거나 참여 중인 계정이에요.", // i18n-ignore
  // i18n-ignore
  "이전 대화가 너무 깁니다. 새 대화를 시작해 주세요.":
    "이전 대화가 너무 길어요. 새 대화를 시작해 주세요.", // i18n-ignore
  "일정에 접근할 수 없습니다.": "일정에 접근할 수 없어요.", // i18n-ignore
  "자기 단계에 연결할 수 없습니다.": "단계를 자기 자신에 연결할 수 없어요.", // i18n-ignore
  "자기 안으로 이동할 수 없습니다.": "폴더를 자기 안으로 옮길 수 없어요.", // i18n-ignore
  // i18n-ignore
  "작성자만 공개 범위를 변경할 수 있습니다.":
    "작성자만 공개 범위를 변경할 수 있어요.", // i18n-ignore
  "작업 기한을 확인해 주세요.": "할 일 기한을 확인해 주세요.", // i18n-ignore
  // i18n-ignore
  "작업 상태·우선순위를 확인해 주세요.":
    "할 일 상태와 우선순위를 확인해 주세요.", // i18n-ignore
  "잘못된 AI 상태": "AI 상태가 올바르지 않아요.", // i18n-ignore
  // i18n-ignore
  "저장한 현재 문서로 버전을 만들어 주세요.":
    "저장한 현재 문서로 버전을 남겨 주세요.", // i18n-ignore
  "전사문이 너무 깁니다.": "전사문이 너무 길어요.", // i18n-ignore
  "접근할 수 없습니다.": "접근할 수 없어요.", // i18n-ignore
  // i18n-ignore
  "정리 후보의 원문 근거를 확인할 수 없습니다. 직접 작성하거나 다시 시도해 주세요.":
    "AI가 정리한 내용의 원문 근거를 확인할 수 없어요. 직접 작성하거나 다시 시도해 주세요.", // i18n-ignore
  "제안된 시간만 선택해 주세요.": "후보 시간 중에서만 선택해 주세요.", // i18n-ignore
  "조율 중인 일정에서 확정해 주세요.": "조율 중인 일정만 확정할 수 있어요.", // i18n-ignore
  "중단한 요청입니다.": "중단한 요청이에요.", // i18n-ignore
  "지원하지 않는 요청입니다.": "지원하지 않는 요청이에요.", // i18n-ignore
  // i18n-ignore
  "지정된 교수 계정만 응답할 수 있습니다.":
    "공유가 중지됐거나 검토할 교수 계정이 바뀌어 응답할 수 없어요. 새로고침해 주세요.", // i18n-ignore
  "참여자 동작을 확인해 주세요.": "참여자 관리 요청을 확인해 주세요.", // i18n-ignore
  "채택할 결과를 확인해 주세요.": "선택할 AI 제안을 확인해 주세요.", // i18n-ignore
  // i18n-ignore
  "처음 인식한 원문과 동의 기록은 변경할 수 없습니다.":
    "처음 인식한 원문과 동의 기록은 변경할 수 없어요.", // i18n-ignore
  // i18n-ignore
  "파일 업로드를 완료한 뒤 연결해 주세요.":
    "파일 업로드를 완료한 뒤 등록해 주세요.", // i18n-ignore
  "파일 저장을 먼저 완료해 주세요.": "파일 업로드를 먼저 마쳐 주세요.", // i18n-ignore
  // i18n-ignore
  "폴더 연결에 순환이 생깁니다.":
    "폴더를 자기 하위 폴더 안으로 옮길 수 없어요.", // i18n-ignore
  "피드백 처리 상태를 확인해 주세요.": "피드백 상태를 확인해 주세요.", // i18n-ignore
  "허용되지 않은 접속 주소입니다.": "허용되지 않은 접속 주소예요.", // i18n-ignore
  // i18n-ignore
  "허용된 시연 계정으로 로그인해 주세요.":
    "초대받은 계정만 쓸 수 있어요. 로그인한 채로 받은 초대 링크를 열어 주세요.", // i18n-ignore
  // i18n-ignore
  "초대 링크가 만료됐거나 올바르지 않습니다.":
    "초대 링크가 만료됐거나 올바르지 않아요. 초대한 사람에게 새 링크를 받아 주세요.", // i18n-ignore
  "사용이 중지된 계정입니다.": "사용이 중지된 계정이에요.", // i18n-ignore
  // i18n-ignore
  "이메일 확인을 먼저 마쳐 주세요.": "이메일 확인을 먼저 마쳐 주세요.", // i18n-ignore
  // i18n-ignore
  "현재 설정한 AI 모델을 사용할 수 없습니다. 연결 설정을 확인해 주세요.":
    "현재 설정한 AI 모델을 사용할 수 없어요. 연결 설정을 확인해 주세요.", // i18n-ignore
  // i18n-ignore
  "휴지통의 연구만 완전히 삭제할 수 있습니다.":
    "휴지통에 있는 연구만 완전히 삭제할 수 있어요.", // i18n-ignore
  // 연구 초대 메일(20261111150000_project_invites.sql, functions/project-invite)
  // i18n-ignore
  "오늘 보낼 수 있는 초대 메일을 모두 보냈습니다. 내일 다시 시도해 주세요.":
    "오늘 보낼 수 있는 초대 메일을 모두 보냈어요. 내일 다시 시도해 주세요.", // i18n-ignore
  "초대할 역할을 확인해 주세요.": "초대할 역할을 확인해 주세요.", // i18n-ignore
  // i18n-ignore
  "초대를 만들지 못했습니다. 다시 시도해 주세요.":
    "초대를 만들지 못했어요. 다시 시도해 주세요.", // i18n-ignore
  "이메일 주소를 확인해 주세요.": "이메일 주소를 확인해 주세요.", // i18n-ignore
  // i18n-ignore
  "이 연구에 초대할 권한이 없습니다.":
    "이 연구에 초대할 권한이 없어요. 연구 소유자에게 요청해 주세요.", // i18n-ignore
  // i18n-ignore
  "내 이메일로는 초대할 수 없습니다.": "내 이메일로는 초대할 수 없어요.", // i18n-ignore
  // i18n-ignore
  "이미 이 연구에 참여하고 있는 사람입니다.":
    "이미 이 연구에 참여하고 있는 사람이에요.", // i18n-ignore
  // i18n-ignore
  "이미 마진을 쓰고 있는 이메일입니다. 검토 요청을 바로 보낼 수 있습니다.":
    "이미 마진을 쓰고 있는 이메일이에요. 초대 없이 검토 요청을 바로 보낼 수 있어요.", // i18n-ignore
  // i18n-ignore
  "이미 초대한 이메일입니다. 초대 목록에서 다시 보낼 수 있습니다.":
    "이미 초대한 이메일이에요. 아래 초대 목록에서 다시 보낼 수 있어요.", // i18n-ignore
  // i18n-ignore
  "초대를 다시 보내지 못했습니다. 다시 시도해 주세요.":
    "초대를 다시 보내지 못했어요. 다시 시도해 주세요.", // i18n-ignore
  // i18n-ignore
  "이 초대를 관리할 권한이 없습니다.":
    "이 초대는 초대한 사람이나 연구 소유자만 관리할 수 있어요.", // i18n-ignore
  // i18n-ignore
  "이미 수락했거나 취소한 초대입니다.":
    "이미 수락했거나 취소한 초대예요. 목록을 새로고침해 확인해 주세요.", // i18n-ignore
  // i18n-ignore
  "방금 보냈습니다. 1분 뒤에 다시 보낼 수 있습니다.":
    "방금 보냈어요. 1분 뒤에 다시 보낼 수 있어요.", // i18n-ignore
  // i18n-ignore
  "이 초대는 더 보낼 수 없습니다. 취소한 뒤 새로 초대해 주세요.":
    "이 초대는 더 보낼 수 없어요. 취소한 뒤 새로 초대해 주세요.", // i18n-ignore
  // i18n-ignore
  "이미 수락한 초대입니다. 참여자 목록에서 접근을 해제해 주세요.":
    "이미 수락한 초대예요. 참여자 목록에서 접근을 해제해 주세요.", // i18n-ignore
  // i18n-ignore
  "이 연구의 초대를 볼 권한이 없습니다.": "이 연구의 초대를 볼 권한이 없어요.", // i18n-ignore
  // i18n-ignore
  "초대 링크가 올바르지 않습니다.":
    "초대 링크가 올바르지 않아요. 메일의 링크를 다시 열어 주세요.", // i18n-ignore
  // i18n-ignore
  "초대받은 이메일로 로그인해 주세요.":
    "초대받은 이메일로 로그인해야 수락할 수 있어요.", // i18n-ignore
  // i18n-ignore
  "이미 사용한 초대 링크입니다.": "이미 사용한 초대 링크예요.", // i18n-ignore
  // i18n-ignore
  "취소된 초대입니다. 초대한 사람에게 다시 요청해 주세요.":
    "취소된 초대예요. 초대한 사람에게 다시 요청해 주세요.", // i18n-ignore
  // i18n-ignore
  "초대 링크가 만료됐습니다. 초대한 사람에게 다시 요청해 주세요.":
    "초대 링크가 만료됐어요. 초대한 사람에게 다시 요청해 주세요.", // i18n-ignore
  // i18n-ignore
  "지금은 수락할 수 없는 초대입니다. 초대한 사람에게 다시 요청해 주세요.":
    "지금은 수락할 수 없는 초대예요. 초대한 사람에게 다시 요청해 주세요.", // i18n-ignore
  // i18n-ignore
  "초대를 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.":
    "초대를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.", // i18n-ignore
};

/**
 * The server fills `%` with the raw JSON key of the field (rms_required_text /
 * rms_optional_text). Show the field's Korean name instead; never the key.
 */
export const FIELD_LABELS: Record<string, string> = {
  title: "제목", // i18n-ignore
  text: "내용", // i18n-ignore
  description: "설명", // i18n-ignore
  sourceQuote: "원문 발췌", // i18n-ignore
  body: "본문", // i18n-ignore
  notes: "메모", // i18n-ignore
  requiredMaterials: "필요한 자료", // i18n-ignore
  method: "방법", // i18n-ignore
  memo: "메모", // i18n-ignore
  location: "볼 위치", // i18n-ignore
  goal: "목표", // i18n-ignore
  fileName: "파일 이름", // i18n-ignore
  expectedResult: "예상 결과", // i18n-ignore
  assumptions: "확인할 가정", // i18n-ignore
  name: "이름", // i18n-ignore
  professorEmail: "교수 계정 이메일", // i18n-ignore
  comment: "댓글", // i18n-ignore
};

/** Messages with a runtime field name (SQL `%` placeholder). */
const PATTERNS: Array<[RegExp, (field: string) => string]> = [
  [
    /^([A-Za-z][A-Za-z0-9_]*) 입력을 확인해 주세요\.$/u,
    (f) =>
      FIELD_LABELS[f.trim()]
        ? t("{field} 입력을 확인해 주세요.", {
            field: t(FIELD_LABELS[f.trim()]),
          })
        : t("입력한 내용을 확인해 주세요."),
  ],
  [
    /^([A-Za-z][A-Za-z0-9_]*) 입력 길이를 확인해 주세요\.$/u,
    (f) =>
      FIELD_LABELS[f.trim()]
        ? t("{field} 입력 길이를 확인해 주세요.", {
            field: t(FIELD_LABELS[f.trim()]),
          })
        : t("입력한 내용의 길이를 확인해 주세요."),
  ],
];

/**
 * 요청 자체가 실패하면 supabase-js가 브라우저 오류를 `이름: 내용`으로 돌려줘요
 * (예: AbortSignal.timeout → "TimeoutError: signal timed out"). 영어 원문이
 * 화면에 그대로 나오지 않게 바꿉니다(QA F-003).
 */
export const REQUEST_FAILURES: Array<[RegExp, string]> = [
  [
    /^(TimeoutError|AbortError):/u,
    "서버 응답이 늦어 요청을 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.", // i18n-ignore
  ],
  [
    /^TypeError: (Failed to fetch|Load failed|NetworkError)/iu,
    "서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.", // i18n-ignore
  ],
];

/** Returns the 마진-style wording for a known server message, else the input. */
export function localizeServerMessage(message: string): string {
  const text = message.trim();
  for (const [pattern, wording] of REQUEST_FAILURES)
    if (pattern.test(text)) return t(wording);
  const exact = EXACT[text];
  if (exact) return t(exact);
  for (const [pattern, build] of PATTERNS) {
    const match = pattern.exec(text);
    if (match) return build(match[1]);
  }
  return message;
}
