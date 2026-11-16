import { expect, it } from "vitest";
import {
  recordBody,
  workspaceContexts,
  workspaceSourceText,
} from "./workspace";

const rows = [
  {
    id: "m2",
    kind: "meetings",
    data: { title: "6차 미팅", date: "2026-11-10", memo: "", memoRevision: 1 },
  },
  {
    id: "m1",
    kind: "meetings",
    data: {
      title: "5차 미팅",
      date: "2026-11-03",
      memo: "선행연구 기준을 보완하기로 함",
      memoRevision: 4,
    },
  },
  {
    id: "f-done",
    kind: "feedback",
    data: { title: "끝난 피드백", body: "반영함", status: "recorded" },
  },
  {
    id: "f-open",
    kind: "feedback",
    data: { title: "열린 피드백", body: "대상 구체화", status: "unprocessed" },
  },
  {
    id: "t1",
    kind: "tasks",
    data: { title: "표 작성", status: "todo", dueDate: "2026-11-18" },
  },
  {
    id: "d1",
    kind: "documents",
    data: { title: "계획서", text: "서론 본문", revision: 2 },
  },
  {
    id: "a1",
    kind: "attachments",
    data: { title: "논문.pdf", text: "[1쪽] 초록" },
  },
  {
    id: "gone",
    kind: "tasks",
    data: { title: "보관한 일", archivedAt: "2026-11-01" },
  },
  {
    id: "chat",
    kind: "conversations",
    data: { title: "개인 대화", messages: [{ text: "비공개 대화" }] },
  },
  {
    id: "cand",
    kind: "aiCandidates",
    data: { title: "미채택 제안", candidate: { body: "비공개 제안" } },
  },
];

it("질문에는 이 연구의 기록을 전부 넣고 개인 대화·미채택 제안·보관 기록은 뺀다", () => {
  const result = workspaceContexts(rows, "ask_research");
  expect(result.map((c) => c.id)).toEqual([
    "m2",
    "m1",
    "f-done",
    "f-open",
    "t1",
    "d1",
    "a1",
  ]);
  const text = workspaceSourceText(result);
  expect(text).toContain("[근거 2] 미팅 · 5차 미팅");
  expect(text).toContain("선행연구 기준을 보완하기로 함");
  expect(text).not.toContain("비공개");
  expect(text).not.toContain("보관한 일");
});

it("이미 첨부한 기록은 다시 넣지 않고 한도를 넘기지 않는다", () => {
  const long = Array.from({ length: 40 }, (_, i) => ({
    id: `doc-${i}`,
    kind: "documents",
    data: { title: `원고 ${i}`, text: "가".repeat(9000) },
  }));
  const result = workspaceContexts(long, "ask_research", {
    exclude: new Set(["doc-0"]),
  });
  expect(result[0].id).toBe("doc-1");
  expect(result[0].text).toContain("길어서 여기까지만 읽었어요");
  expect(workspaceSourceText(result).length).toBeLessThanOrEqual(48000);
});

it("대상이 하나여야 하는 요청은 가장 최근 것 하나만 고른다", () => {
  const meeting = workspaceContexts(rows, "organize_meeting");
  expect(meeting).toHaveLength(1);
  expect(meeting[0]).toMatchObject({ id: "m1", revision: 4 });
  expect(workspaceContexts(rows, "suggest_revisions")[0].id).toBe("f-open");
  expect(workspaceContexts(rows, "review_writing")[0]).toMatchObject({
    id: "d1",
    revision: 2,
  });
  expect(workspaceContexts(rows, "read_material")[0].id).toBe("a1");
  expect(workspaceContexts([], "organize_meeting")).toEqual([]);
});

it("할 일 정리는 일정과 관련된 기록만 읽는다", () => {
  expect(
    workspaceContexts(rows, "plan_research").map((c) => c.kind),
  ).not.toContain("documents");
});

it("미팅 원문은 메모를 그대로 담아 발췌 확인에 쓸 수 있다", () => {
  expect(recordBody(rows[1])).toContain("선행연구 기준을 보완하기로 함");
});
