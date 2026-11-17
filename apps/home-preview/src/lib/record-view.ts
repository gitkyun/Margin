import type {
  Decision,
  Feedback,
  Meeting,
  MeetingPoll,
  Question,
  ReviewRequest,
  Task,
} from "./domain";

/**
 * 미팅 화면(IA v2 04)의 계산 규칙(08 §4). 저장하지 않고 그때그때 계산하는 순수 함수만 둡니다.
 */

/** §4.0 서면 피드백이 아닌 미팅 기록인지 */
export function isMeetingRecord(meeting: Pick<Meeting, "recordType">): boolean {
  return (meeting.recordType ?? "meeting") === "meeting";
}

/** §4.4 한 기록의 피드백·결정·질문·할 일 */
export function recordItems(
  meeting: Pick<Meeting, "id">,
  data: {
    feedback: Feedback[];
    decisions: Decision[];
    questions: Question[];
    tasks: Task[];
  },
) {
  const feedback = data.feedback.filter(
    (item) => item.meetingId === meeting.id && !item.archivedAt,
  );
  const feedbackIds = new Set(feedback.map((item) => item.id));
  const tasks = data.tasks.filter(
    (task) =>
      !task.archivedAt &&
      (task.sourceRecordId === meeting.id ||
        task.feedbackIds.some((id) => feedbackIds.has(id))),
  );
  return {
    feedback,
    decisions: data.decisions.filter(
      (item) => item.meetingId === meeting.id && !item.archivedAt,
    ),
    questions: data.questions.filter(
      (item) => item.meetingId === meeting.id && !item.archivedAt,
    ),
    tasks,
    remaining: tasks.filter((task) => task.status !== "done").length,
  };
}

/** 기록의 앞뒤를 가르는 기준: 날짜(+시각), 날짜가 없으면 만든 시각 */
function recordKey(meeting: Pick<Meeting, "date" | "time" | "createdAt">) {
  return meeting.date
    ? `${meeting.date}T${meeting.time ?? "00:00"}`
    : meeting.createdAt;
}

/**
 * §4.5 넘어온 할 일: 준비 중인 미팅 n보다 앞선 기록의 할 일 가운데 끝내지 않았고
 * n에 아직 가져가지 않은 것. 복사하지 않습니다(가져가기 = n.taskIds에 id를 넣음).
 */
export function carriedTasks(
  next: Meeting,
  data: {
    meetings: Meeting[];
    feedback: Feedback[];
    decisions: Decision[];
    questions: Question[];
    tasks: Task[];
  },
): Task[] {
  const nextKey = recordKey(next);
  const seen = new Set<string>();
  const result: Task[] = [];
  for (const meeting of data.meetings) {
    if (meeting.id === next.id || meeting.archivedAt) continue;
    if (meeting.researchId !== next.researchId) continue;
    if (!(recordKey(meeting) < nextKey)) continue;
    for (const task of recordItems(meeting, data).tasks) {
      if (task.status === "done" || next.taskIds.includes(task.id)) continue;
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      result.push(task);
    }
  }
  return result;
}

export type RecordMode =
  | "recording"
  | "unfinished"
  | "drafting"
  | "prepare"
  | "recorded"
  | "cancelled";

/**
 * §4.3 기록 화면의 모드. `recordingHere`는 이 탭에서 이 기록을 녹음 중인지(RecordingProvider).
 * 주소의 `mode`가 있으면 그것을 우선하되, 끝난 기록에 녹음을 새로 붙이지는 않습니다.
 */
export function recordMode(
  meeting: Pick<Meeting, "status" | "memo" | "recordType">,
  recordingHere: boolean,
  urlMode?: string | null,
): RecordMode {
  if (recordingHere) return "recording";
  const finished =
    meeting.recordType === "written" ||
    meeting.status === "recorded" ||
    meeting.status === "cancelled";
  if (urlMode === "prepare") return "prepare";
  if (urlMode === "record" && !finished) return "drafting";
  if (meeting.status === "recording") return "unfinished";
  if (meeting.recordType === "written" || meeting.status === "recorded")
    return "recorded";
  if (meeting.status === "cancelled") return "cancelled";
  if (meeting.memo.trim()) return "drafting";
  return "prepare";
}

export type RecordFilter = "all" | "open" | "written" | "review" | "poll";

export type RecordRow =
  | {
      kind: "meeting";
      id: string;
      meeting: Meeting;
      sortKey: string;
      remaining: number;
      state:
        "recording" | "preparing" | "unrecorded" | "recorded" | "cancelled";
    }
  | { kind: "review"; id: string; review: ReviewRequest; sortKey: string }
  | { kind: "poll"; id: string; poll: MeetingPoll; sortKey: string };

export interface RecordGroup {
  key: string;
  /** "now" | "upcoming" | "YYYY-MM" | "polls-past" */
  label: { kind: "now" | "upcoming" | "month" | "polls-past"; month?: string };
  rows: RecordRow[];
}

/**
 * §4.2 미팅 목록의 줄과 묶음. 지금(이 탭에서 녹음 중) → 예정(날짜 가까운 순) → 지난 기록(월별 최신순).
 * 취소한 미팅은 `showCancelled`일 때만 지난 기록 안에 넣습니다.
 */
export function recordGroups(input: {
  researchId: string;
  today: string;
  meetings: Meeting[];
  reviews: ReviewRequest[];
  polls: MeetingPoll[];
  feedback: Feedback[];
  decisions: Decision[];
  questions: Question[];
  tasks: Task[];
  recordingId?: string | null;
  filter?: RecordFilter;
  query?: string;
  showCancelled?: boolean;
  matches?(text: string, query: string): boolean;
}): RecordGroup[] {
  const filter = input.filter ?? "all";
  const query = input.query?.trim() ?? "";
  const match = (text: string) =>
    !query ||
    (input.matches
      ? input.matches(text, query)
      : text.toLowerCase().includes(query.toLowerCase()));
  const rows: RecordRow[] = [];
  if (filter !== "review" && filter !== "poll")
    for (const meeting of input.meetings) {
      if (meeting.researchId !== input.researchId || meeting.archivedAt)
        continue;
      if (meeting.status === "cancelled" && !input.showCancelled) continue;
      if (filter === "written" && meeting.recordType !== "written") continue;
      if (!match(`${meeting.title} ${meeting.memo}`)) continue;
      const remaining = recordItems(meeting, input).remaining;
      if (filter === "open" && remaining === 0) continue;
      const recordingHere = meeting.id === input.recordingId;
      const state: Extract<RecordRow, { kind: "meeting" }>["state"] =
        recordingHere
          ? "recording"
          : meeting.status === "cancelled"
            ? "cancelled"
            : meeting.recordType === "written" || meeting.status !== "preparing"
              ? "recorded"
              : meeting.date && meeting.date < input.today
                ? "unrecorded"
                : "preparing";
      rows.push({
        kind: "meeting",
        id: meeting.id,
        meeting,
        remaining,
        state,
        sortKey: meeting.date
          ? `${meeting.date}T${meeting.time ?? ""}`
          : `9999-${meeting.createdAt}`,
      });
    }
  if (filter === "all" || filter === "review")
    for (const review of input.reviews) {
      if (review.researchId !== input.researchId || review.archivedAt) continue;
      if (!match(review.title)) continue;
      rows.push({
        kind: "review",
        id: review.id,
        review,
        sortKey: review.createdAt,
      });
    }
  if (filter === "all" || filter === "poll")
    for (const poll of input.polls) {
      if (poll.researchId !== input.researchId) continue;
      if (poll.status !== "open" && filter !== "poll") continue;
      if (!match(poll.title)) continue;
      rows.push({
        kind: "poll",
        id: poll.id,
        poll,
        sortKey: poll.options[0]?.start ?? poll.updatedAt,
      });
    }

  const now = rows.filter(
    (row) => row.kind === "meeting" && row.state === "recording",
  );
  const upcoming = rows
    .filter(
      (row) =>
        (row.kind === "meeting" && row.state === "preparing") ||
        (row.kind === "poll" && row.poll.status === "open"),
    )
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const pollsPast = rows
    .filter((row) => row.kind === "poll" && row.poll.status !== "open")
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const past = rows
    .filter(
      (row) =>
        (row.kind === "meeting" &&
          row.state !== "recording" &&
          row.state !== "preparing") ||
        row.kind === "review",
    )
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const groups: RecordGroup[] = [];
  if (now.length)
    groups.push({ key: "now", label: { kind: "now" }, rows: now });
  if (upcoming.length)
    groups.push({
      key: "upcoming",
      label: { kind: "upcoming" },
      rows: upcoming,
    });
  for (const row of past) {
    const month = row.sortKey.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last?.label.kind === "month" && last.label.month === month)
      last.rows.push(row);
    else
      groups.push({
        key: month,
        label: { kind: "month", month },
        rows: [row],
      });
  }
  if (pollsPast.length)
    groups.push({
      key: "polls-past",
      label: { kind: "polls-past" },
      rows: pollsPast,
    });
  return groups;
}
