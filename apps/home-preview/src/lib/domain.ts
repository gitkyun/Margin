export type ID = string;
export type RecordOrigin = "manual" | "ai";
export interface BaseRecord {
  id: ID;
  researchId: ID;
  createdAt: string;
  updatedAt: string;
}
export interface Research {
  id: ID;
  ownerId: ID;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  nextMeetingId?: ID;
}
export interface Meeting extends BaseRecord {
  title: string;
  date: string | null;
  time: string | null;
  status: "preparing" | "recording" | "recorded" | "cancelled";
  goal: string;
  memo: string;
  memoRevision: number;
  taskIds: ID[];
  versionIds: ID[];
  questionIds: ID[];
}
export interface Feedback extends BaseRecord {
  origin?: RecordOrigin;
  title: string;
  body: string;
  meetingId?: ID;
  sourceQuote?: string;
  sourceMemoRevision?: number;
  sourceStart?: number;
  sourceEnd?: number;
  status: "unprocessed" | "in_progress" | "recorded" | "held" | "unchanged";
  notes: string;
}
export interface RevisionPlan extends BaseRecord {
  origin?: RecordOrigin;
  feedbackId: ID;
  title: string;
  method: string;
  expectedResult: string;
  assumptions: string;
  sourceQuote?: string;
  requiredMaterials: string;
  suggestedTasks: string[];
  status: "suggested" | "saved" | "cancelled";
}
export interface Task extends BaseRecord {
  origin?: RecordOrigin;
  title: string;
  description: string;
  status: "todo" | "doing" | "done";
  dueDate: string | null;
  priority: "high" | "normal" | "low";
  feedbackIds: ID[];
  planId?: ID;
}
export interface Question extends BaseRecord {
  origin?: RecordOrigin;
  meetingId?: ID;
  text: string;
  status: "open" | "resolved";
}
export interface Decision extends BaseRecord {
  origin?: RecordOrigin;
  meetingId: ID;
  text: string;
}
export interface Material extends BaseRecord {
  title: string;
  type: "draft" | "reference" | "analysis" | "other";
  externalUrl?: string;
}
export interface MaterialVersion extends BaseRecord {
  materialId: ID;
  number: number;
  fileName: string;
  storagePath: string;
  size: number;
  mimeType: string;
}
export interface RevisionResult extends BaseRecord {
  title: string;
  description: string;
  feedbackIds: ID[];
  taskIds: ID[];
  kind: "document" | "other";
  versionId?: ID;
  location: string;
}
export interface ReviewRequest extends BaseRecord {
  title: string;
  professorEmail: string;
  professorId?: ID;
  status: "draft" | "shared" | "stopped";
}
export interface ReviewItem {
  id: ID;
  requestId: ID;
  resultId: ID;
  title: string;
}
export interface ReviewRound {
  id: ID;
  requestId: ID;
  itemId: ID;
  number: number;
  title: string;
  description: string;
  feedbackExcerpt: string;
  versionId?: ID;
  fileName?: string;
  storagePath?: string;
  location: string;
  createdAt: string;
}
export interface ReviewResponse {
  id: ID;
  roundId: ID;
  userId: ID;
  result: "confirmed" | "changes_requested";
  comment: string;
  createdAt: string;
  updatedAt: string;
}
export interface ReviewComment {
  id: ID;
  roundId: ID;
  userId: ID;
  authorName: string;
  body: string;
  parentId?: ID;
  resolved: boolean;
  createdAt: string;
}
export interface ReviewRead {
  roundId: ID;
  userId: ID;
  lastSeenAt: string;
}
export interface EntityMap {
  meetings: Meeting;
  feedback: Feedback;
  plans: RevisionPlan;
  tasks: Task;
  questions: Question;
  decisions: Decision;
  materials: Material;
  versions: MaterialVersion;
  results: RevisionResult;
}
export type EntityKind = keyof EntityMap;
export interface WorkspaceData {
  researches: Research[];
  meetings: Meeting[];
  feedback: Feedback[];
  plans: RevisionPlan[];
  tasks: Task[];
  questions: Question[];
  decisions: Decision[];
  materials: Material[];
  versions: MaterialVersion[];
  results: RevisionResult[];
  reviews: ReviewRequest[];
  reviewItems: ReviewItem[];
  rounds: ReviewRound[];
  responses: ReviewResponse[];
  comments: ReviewComment[];
  reads: ReviewRead[];
}
export interface AppUser {
  id: ID;
  email: string;
  name: string;
}
export interface AICandidate {
  title: string;
  body?: string;
  category?: "feedback" | "decision" | "question";
  sourceQuote?: string;
  sourceStart?: number;
  sourceEnd?: number;
  method?: string;
  expectedResult?: string;
  assumptions?: string;
  requiredMaterials?: string;
  suggestedTasks?: string[];
}
export interface AIResult {
  candidates: AICandidate[];
  model: string;
  sourceRevision?: number;
  createdAt: string;
}
export interface AIInput {
  mode: "organize_meeting" | "suggest_revisions";
  researchId: ID;
  meetingId?: ID;
  feedbackId?: ID;
  sourceText: string;
  sourceRevision?: number;
}
export const emptyWorkspace = (): WorkspaceData => ({
  researches: [],
  meetings: [],
  feedback: [],
  plans: [],
  tasks: [],
  questions: [],
  decisions: [],
  materials: [],
  versions: [],
  results: [],
  reviews: [],
  reviewItems: [],
  rounds: [],
  responses: [],
  comments: [],
  reads: [],
});
export const taskLabels = {
  todo: "진행 전",
  doing: "진행 중",
  done: "완료",
} as const;
export const originLabels = {
  manual: "직접 작성",
  ai: "AI 제안에서 작성",
} as const;
export const feedbackLabels = {
  unprocessed: "처리 전",
  in_progress: "진행 중",
  recorded: "반영 기록 있음",
  held: "보류",
  unchanged: "미수정 결정",
} as const;
export const meetingLabels = {
  preparing: "준비 중",
  recording: "기록 중",
  recorded: "기록 완료",
  cancelled: "취소",
} as const;
export const responseLabels = {
  confirmed: "수정 내용 확인",
  changes_requested: "추가 수정 필요",
} as const;
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function recordBase(researchId: string): BaseRecord {
  const t = now();
  return { id: uid(), researchId, createdAt: t, updatedAt: t };
}
export function formatDate(
  date?: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!date) return "날짜 미정";
  return new Intl.DateTimeFormat(
    "ko-KR",
    options ?? { month: "long", day: "numeric", weekday: "short" },
  ).format(new Date(`${date.slice(0, 10)}T12:00:00`));
}
export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
