import { t } from "@/lib/i18n";
import type { AIInput, WorkspaceData } from "@/lib/domain";
import { documentFeedback, documentTasks, isHandled } from "@/lib/doc-margin";

export interface Starter {
  /** 겹치지 않게 고르는 열쇠 */
  id: string;
  /** 버튼 글자 */
  label: string;
  /** 고르면 입력창에 채울 요청 종류. 없으면 묻고 답하기 */
  mode?: AIInput["mode"];
  /** 고르면 입력창에 채울 질문(보내기는 사용자가) */
  prompt: string;
}

const MAX = 3;

/**
 * 빈 대화의 첫 화면(IA v2 06 §2.6). AI를 부르지 않고 지금 화면과 저장된 기록만 보고
 * 해 볼 만한 것을 세 개까지 권합니다. 고르면 요청 종류와 입력창이 채워질 뿐, 보내기는 사용자가 합니다.
 */
export function assistantStarters(
  pathname: string,
  data: Pick<
    WorkspaceData,
    "meetings" | "documents" | "materials" | "feedback" | "tasks"
  >,
  researchId: string,
): Starter[] {
  const out: Starter[] = [];
  const add = (starter: Starter) => {
    if (out.length < MAX && !out.some((s) => s.id === starter.id))
      out.push(starter);
  };
  const base = `/r/${researchId}`;
  const [section, sub, id] = pathname.startsWith(`${base}/`)
    ? pathname.slice(base.length + 1).split("/")
    : [];
  const live = <T extends { researchId: string; archivedAt?: string }>(
    items: T[],
  ) => items.filter((i) => i.researchId === researchId && !i.archivedAt);

  if (section === "meetings" && sub) {
    const meeting = live(data.meetings).find((m) => m.id === sub);
    if (meeting?.status === "recorded") {
      if (!meeting.summary)
        add({
          id: "organize",
          label: t("이 기록 정리하기"),
          mode: "organize_meeting",
          prompt: t("이 기록을 요약하고 피드백·할 일을 뽑아 줘"),
        });
      const open = live(data.feedback).some(
        (f) => f.meetingId === meeting.id && !isHandled(f.status),
      );
      if (open)
        add({
          id: "revisions",
          label: t("남은 피드백의 수정 방법 제안받기"),
          mode: "suggest_revisions",
          prompt: t("이 기록의 남은 피드백을 어떻게 고치면 좋을지 제안해 줘"),
        });
    } else if (meeting?.status === "preparing") {
      const carried = live(data.tasks).some(
        (task) => meeting.taskIds.includes(task.id) && task.status !== "done",
      );
      if (carried)
        add({
          id: "prepare",
          label: t("이번 미팅에 보여 줄 것 정리하기"),
          prompt: t(
            "이번 미팅에 가져갈 할 일과 보여 줄 것을 순서대로 정리해 줘",
          ),
        });
      add({
        id: "questions",
        label: t("물어볼 질문 제안받기"),
        prompt: t("이번 미팅에서 교수님께 물어볼 질문을 제안해 줘"),
      });
    }
  }

  if (section === "docs" && sub === "w" && id) {
    const doc = live(data.documents).find((d) => d.id === id);
    if (doc) {
      const left = documentFeedback(
        documentTasks(data.tasks, doc.id),
        data.feedback,
      ).some(({ feedback }) => !isHandled(feedback.status));
      if (left)
        add({
          id: "doc-feedback",
          label: t("남은 피드백으로 이 글 점검하기"),
          mode: "review_writing",
          prompt: t("이 글에 연결된 남은 피드백을 기준으로 고칠 곳을 짚어 줘"),
        });
      add({
        id: "doc-flow",
        label: t("이 글의 흐름 점검하기"),
        mode: "review_writing",
        prompt: t("이 글의 흐름과 근거가 약한 곳을 점검해 줘"),
      });
    }
  }

  if (pathname === base || pathname === `${base}/`) {
    const open = live(data.tasks).some((task) => task.status !== "done");
    if (open)
      add({
        id: "week",
        label: t("이번 주 할 일 정리하기"),
        mode: "plan_research",
        prompt: t("남은 할 일을 다음 미팅 기준으로 정리해 줘"),
      });
  }

  // 어디서나: 연구에 기록이 거의 없으면 파일을 올려 읽게 하기를 권합니다.
  const records =
    live(data.meetings).length +
    live(data.documents).length +
    live(data.materials).length +
    live(data.feedback).length;
  if (records < 2)
    add({
      id: "upload",
      label: t("파일을 올려 읽게 하기"),
      mode: "read_material",
      prompt: t("첨부한 파일을 읽고 요약해 줘"),
    });
  return out;
}
