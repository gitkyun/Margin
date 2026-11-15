import { describe, expect, it } from "vitest";
import { emptyWorkspace, type WorkspaceData } from "./domain";
import { buildCommands, rankSections } from "./command-items";

const RESEARCH = "r1";

function fixture(): WorkspaceData {
  const data = emptyWorkspace();
  const research = (id: string, name: string, extra = {}) => ({
    id,
    ownerId: "u1",
    name,
    description: "",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...extra,
  });
  const task = (id: string, title: string, updatedAt: string, extra = {}) =>
    ({
      id,
      researchId: RESEARCH,
      title,
      createdAt: updatedAt,
      updatedAt,
      ...extra,
    }) as unknown as WorkspaceData["tasks"][number];
  return {
    ...data,
    researches: [
      research(RESEARCH, "지금 연구"),
      research("r2", "다른 연구"),
      research("r3", "지운 연구", { deletedAt: "2026-02-01" }),
    ],
    tasks: [
      ...Array.from({ length: 6 }, (_, i) =>
        task(`t${i}`, `할 일 ${i}`, `2026-03-0${i + 1}`),
      ),
      task("old", "보관한 할 일", "2026-09-01", { archivedAt: "2026-09-02" }),
      {
        ...task("other", "다른 연구 할 일", "2026-09-01"),
        researchId: "r2",
      },
    ],
  };
}

const ids = (sections: ReturnType<typeof buildCommands>, id: string) =>
  sections.find((s) => s.id === id)?.entries.map((e) => e.id) ?? [];

describe("buildCommands", () => {
  it("shows the five most recently updated records when the input is empty", () => {
    const sections = buildCommands({
      data: fixture(),
      researchId: RESEARCH,
      searching: false,
    });
    expect(ids(sections, "recent")).toEqual([
      "recent:tasks:t5",
      "recent:tasks:t4",
      "recent:tasks:t3",
      "recent:tasks:t2",
      "recent:tasks:t1",
    ]);
    expect(ids(sections, "researches")).toEqual(["research:r2"]);
  });

  it("offers every record and the other live researches while searching", () => {
    const sections = buildCommands({
      data: fixture(),
      researchId: RESEARCH,
      searching: true,
    });
    const records = ids(sections, "records");
    expect(records).toHaveLength(6);
    expect(records).not.toContain("record:tasks:old");
    expect(records).not.toContain("record:tasks:other");
    expect(ids(sections, "researches")).toEqual(["research:r2"]);
  });

  it("finds a decision by its text or reason and opens the meeting it was made in", () => {
    const decision = {
      id: "d1",
      researchId: RESEARCH,
      meetingId: "m1",
      text: "표본을 대학원생으로 좁힌다",
      reason: "모집이 가능한 범위라서",
      createdAt: "2026-03-01",
      updatedAt: "2026-03-01",
    } as unknown as WorkspaceData["decisions"][number];
    const sections = buildCommands({
      data: {
        ...fixture(),
        decisions: [
          decision,
          { ...decision, id: "d2", archivedAt: "2026-03-02" },
        ],
      },
      researchId: RESEARCH,
      searching: true,
    });
    const records = sections.find((s) => s.id === "records")!.entries;
    const found = records.filter((e) => e.id.startsWith("record:decisions:"));
    expect(found.map((e) => e.id)).toEqual(["record:decisions:d1"]);
    expect(found[0].keywords).toContain("모집이 가능한 범위라서");
    expect(found[0].action).toEqual({
      kind: "navigate",
      to: `/r/${RESEARCH}/meetings/m1?tab=questions`,
    });
  });

  it("links create actions to the existing ?new=1 screens", () => {
    const sections = buildCommands({
      data: fixture(),
      researchId: RESEARCH,
      searching: false,
    });
    const create = sections.find((s) => s.id === "create")!.entries;
    expect(create.map((e) => e.action)).toContainEqual({
      kind: "navigate",
      to: `/r/${RESEARCH}/meetings?new=1`,
    });
  });

  it("outside a research lists researches, no research pages and no theme entries", () => {
    const sections = buildCommands({
      data: fixture(),
      searching: false,
    });
    expect(sections.map((s) => s.id)).toEqual(["create", "go", "researches"]);
    expect(ids(sections, "go")).not.toContain("go:planning");
  });
});

describe("rankSections", () => {
  it("puts the section with the best match first and drops empty ones", () => {
    const sections = buildCommands({
      data: fixture(),
      researchId: RESEARCH,
      searching: true,
    });
    const ranked = rankSections(sections, "ㅁㅌ");
    expect(ranked[0].id).toBe("create");
    expect(ranked.map((s) => s.id)).not.toContain("theme");
  });

  it("keeps the original order for an empty query", () => {
    const sections = buildCommands({
      data: fixture(),
      researchId: RESEARCH,
      searching: false,
    });
    expect(rankSections(sections, " ")).toEqual(sections);
  });
});
