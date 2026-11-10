import { describe, expect, it } from "vitest";
import { buildCommands, recordEntries } from "../src/lib/command-items";
import type { WorkspaceData } from "../src/lib/domain";

const R = "r1";
const empty = {
  documents: [],
  meetings: [],
  feedback: [],
  tasks: [],
  materials: [],
  results: [],
} as unknown as Pick<
  WorkspaceData,
  "documents" | "meetings" | "feedback" | "tasks" | "materials" | "results"
>;

describe("⌘K 명령 목록", () => {
  it("검토 요청을 제목·교수 이메일로 찾고 /reviews/:id로 연다", () => {
    const entries = recordEntries(
      {
        ...empty,
        reviews: [
          {
            id: "q1",
            researchId: R,
            title: "선행연구 수정 결과",
            professorEmail: "prof@example.invalid",
            status: "shared",
            createdAt: "2026-11-01T00:00:00Z",
            updatedAt: "2026-11-02T00:00:00Z",
          },
          {
            id: "q2",
            researchId: "other",
            title: "다른 연구",
            professorEmail: "x@example.invalid",
            status: "draft",
            createdAt: "2026-11-01T00:00:00Z",
            updatedAt: "2026-11-01T00:00:00Z",
          },
        ],
      } as never,
      R,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      hint: "검토 요청",
      action: { kind: "navigate", to: "/reviews/q1" },
    });
    expect(entries[0].keywords).toContain("prof@example.invalid");
  });

  it("연구 안에서는 수정 결과 작성·검토 요청 만들기를 보여 준다", () => {
    const sections = buildCommands({
      data: { ...empty, reviews: [], researches: [] } as never,
      researchId: R,
      searching: false,
    } as never);
    const create = sections.flatMap((s) => s.entries).map((e) => e.id);
    expect(create).toEqual(
      expect.arrayContaining(["create:result", "create:review"]),
    );
  });
});
