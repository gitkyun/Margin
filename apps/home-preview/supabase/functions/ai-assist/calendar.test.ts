import { expect, it } from "vitest";
import { calendarContexts } from "./calendar";
it("includes actual dates and filters archived/cancelled/unrelated records", () => {
  const rows = [
    {
      id: "past",
      kind: "meetings",
      data: { title: "지난 미팅", date: "2026-11-01" },
    },
    {
      id: "soon",
      kind: "tasks",
      data: { title: "표 작성", dueDate: "2026-11-18", status: "todo" },
    },
    {
      id: "cancel",
      kind: "meetings",
      data: { title: "취소", date: "2026-11-17", status: "cancelled" },
    },
    {
      id: "private-note",
      kind: "documents",
      data: { title: "일정 아님", text: "비공개 본문" },
    },
    {
      id: "archived",
      kind: "phases",
      data: { title: "옛 단계", archivedAt: "2026-11-01" },
    },
  ];
  const result = calendarContexts(rows, "2026-11-16");
  expect(result.map((v) => v.id)).toEqual(["soon", "past"]);
  expect(result[0].text).toContain("2026-11-18");
  expect(JSON.stringify(result)).not.toContain("비공개 본문");
});
