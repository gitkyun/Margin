import { t } from "@/lib/i18n";
import {
  recordBase,
  type Feedback,
  type RevisionResult,
  type Task,
} from "@/lib/domain";

export interface ResultDraftSource {
  feedback?: Feedback;
  task?: Task;
  versionId?: string;
}

// A new, unsaved revision result prefilled from where the student started it.
export function newResultDraft(
  researchId: string,
  { feedback, task, versionId }: ResultDraftSource,
): RevisionResult {
  const origin = task ?? feedback;
  return {
    ...recordBase(researchId),
    title: origin ? t("{title} 수정 결과", { title: origin.title }) : "",
    description: "",
    feedbackIds: feedback ? [feedback.id] : (task?.feedbackIds ?? []),
    taskIds: task ? [task.id] : [],
    kind: "document",
    versionId,
    location: "",
  };
}
