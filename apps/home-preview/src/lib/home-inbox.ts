import { t } from "./i18n";
import type { ReviewNotification } from "./notifications";

/** 홈 ‘확인할 내용’ 한 줄: 무엇을 정해야 하는지와 바로 할 수 있는 행동 */
export interface InboxDecision {
  /** 사용자가 정하거나 확인할 일 한 줄 */
  ask: string;
  /** 원래 기록을 여는 주 행동 */
  openLabel: string;
  /** ‘할 일로 만들기’를 낼지(내 수정 결과에 온 응답·댓글만) */
  canMakeTask: boolean;
  /** 할 일로 만들 때의 제목 */
  taskTitle: string;
  icon: "result" | "chat" | "feedback";
}

type DecisionInput = Pick<ReviewNotification, "kind" | "tone" | "title">;

/**
 * 검토 알림을 디시전 인박스 한 줄로 바꿉니다. 알림을 읽음으로 바꾸지 않아요(읽음은 원래 화면에서).
 * 할 일로 만들기는 학생 쪽(응답·댓글)에서만 내고, 교수에게 온 ‘검토할 수정 결과’에는 내지 않아요.
 */
export function reviewDecision(event: DecisionInput): InboxDecision {
  const title = event.title.trim() || t("수정 결과");
  if (event.kind === "response" && event.tone === "amber")
    return {
      ask: t("추가 수정 이유를 보고 다음에 고칠 일을 정해 주세요."),
      openLabel: t("응답 보기"),
      canMakeTask: true,
      taskTitle: t("‘{title}’ 추가 수정", { title }),
      icon: "result",
    };
  if (event.kind === "response")
    return {
      ask: t("응답을 보고 남은 일이 있는지 확인해 주세요."),
      openLabel: t("응답 보기"),
      canMakeTask: false,
      taskTitle: "",
      icon: "result",
    };
  if (event.kind === "comment")
    return {
      ask: t("답글을 남길지, 고칠 일로 옮길지 정해 주세요."),
      openLabel: t("댓글 보기"),
      canMakeTask: true,
      taskTitle: t("‘{title}’ 댓글 반영", { title }),
      icon: "chat",
    };
  return {
    ask: t("수정 결과를 보고 검토 결과를 남겨 주세요."),
    openLabel: t("검토하기"),
    canMakeTask: false,
    taskTitle: "",
    icon: "feedback",
  };
}
