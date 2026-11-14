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

  it("교수 계정은 받은 검토 요청과 그 목록으로만 꾸미고 만들기는 뺀다(감사 F5)", () => {
    const review = (id: string, status: string, professorId = "prof") => ({
      id,
      researchId: "student-r",
      title: `요청 ${id}`,
      professorEmail: "prof@example.invalid",
      professorId,
      status,
      researchName: "학생 연구",
      createdAt: "2026-11-01T00:00:00Z",
      updatedAt: `2026-11-0${id.length}T00:00:00Z`,
    });
    const data = {
      ...empty,
      researches: [],
      reviews: [
        review("a", "shared"),
        review("b", "draft"),
        review("c", "shared", "other"),
      ],
    } as never;
    const sections = buildCommands({
      data,
      searching: false,
      userId: "prof",
    });
    expect(sections.map((s) => s.id)).toEqual(["incoming", "go"]);
    const ids = sections.flatMap((s) => s.entries).map((e) => e.id);
    expect(ids).toEqual(["incoming:a", "go:inbox", "go:account", "go:guide"]);
    expect(sections[0].entries[0].action.to).toBe("/reviews/a");
    expect(ids.some((id) => id.startsWith("create:"))).toBe(false);
  });

  it("내 연구가 있으면 받은 요청이 있어도 학생 팔레트를 그대로 둔다", () => {
    const sections = buildCommands({
      data: {
        ...empty,
        researches: [{ id: R, name: "내 연구" }],
        reviews: [
          {
            id: "a",
            researchId: "x",
            title: "요청",
            professorId: "me",
            status: "shared",
            updatedAt: "2026-11-01T00:00:00Z",
          },
        ],
      } as never,
      searching: false,
      userId: "me",
    });
    const ids = sections.flatMap((s) => s.entries).map((e) => e.id);
    expect(ids).toContain("create:research");
    expect(ids).not.toContain("go:inbox");
  });
});
