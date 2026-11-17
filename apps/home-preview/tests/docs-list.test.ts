import { describe, expect, it } from "vitest";
import {
  docCounts,
  docRows,
  documentOutline,
  folderPath,
} from "../src/lib/docs-list";
import type {
  DocumentRecord,
  Material,
  MaterialVersion,
} from "../src/lib/domain";

const doc = (id: string, patch: Partial<DocumentRecord> = {}) =>
  ({
    id,
    researchId: "r",
    title: id,
    type: "manuscript",
    content: {},
    text: "",
    revision: 1,
    createdAt: "2026-11-01",
    updatedAt: "2026-11-01",
    ...patch,
  }) as DocumentRecord;
const mat = (id: string, patch: Partial<Material> = {}) =>
  ({
    id,
    researchId: "r",
    title: id,
    type: "reference",
    createdAt: "2026-11-01",
    updatedAt: "2026-11-01",
    ...patch,
  }) as Material;
const ver = (id: string, materialId: string, number: number, at: string) =>
  ({
    id,
    researchId: "r",
    materialId,
    number,
    fileName: `${id}.pdf`,
    storagePath: "",
    size: 1,
    mimeType: "application/pdf",
    createdAt: at,
    updatedAt: at,
  }) as MaterialVersion;

const data = {
  documents: [
    doc("계획서", { updatedAt: "2026-11-10", folderId: "f1" }),
    doc("메모", { updatedAt: "2026-11-05" }),
    doc("옛 글", { archivedAt: "x" }),
    doc("남의 연구", { researchId: "other" }),
  ],
  materials: [
    mat("Kim2023", { folderId: "f1" }),
    mat("규정", { externalUrl: "https://a.kr", type: "other" }),
    mat("버린 자료", { archivedAt: "x" }),
  ],
  versions: [
    ver("v1", "Kim2023", 1, "2026-11-02"),
    ver("v2", "Kim2023", 2, "2026-11-12"),
  ],
};
const ids = (view: Parameters<typeof docRows>[2]) =>
  docRows(data, "r", view).map((row) => row.id);

describe("글·자료 한 목록(IA v2 05 §2)", () => {
  it("전체는 최근 고친 순(자료는 새 판 올린 때까지), 이름순도 된다", () => {
    expect(ids({ kind: "all", folder: "" })).toEqual([
      "Kim2023",
      "계획서",
      "메모",
      "규정",
    ]);
    // 한국어 정렬: 한글 이름이 먼저
    expect(ids({ kind: "all", folder: "", sort: "name" })).toEqual([
      "계획서",
      "규정",
      "메모",
      "Kim2023",
    ]);
    const kim = docRows(data, "r", { kind: "material", folder: "" })[0]!;
    expect(kim.kind === "material" && kim.latest?.number).toBe(2);
  });
  it("글·자료·폴더·보관함·종류·찾기", () => {
    expect(ids({ kind: "writing", folder: "" })).toEqual(["계획서", "메모"]);
    expect(ids({ kind: "material", folder: "", type: "link" })).toEqual([
      "규정",
    ]);
    expect(ids({ kind: "all", folder: "f1" })).toEqual(["Kim2023", "계획서"]);
    expect(ids({ kind: "all", folder: "archived" }).sort()).toEqual([
      "버린 자료",
      "옛 글",
    ]);
    expect(ids({ kind: "all", folder: "", query: "v2" })).toEqual(["Kim2023"]);
    expect(docCounts(data, "r")).toEqual({
      all: 4,
      writing: 2,
      material: 2,
      archived: 2,
    });
  });
  it("목차와 폴더 경로", () => {
    expect(
      documentOutline({
        type: "doc",
        content: [
          { type: "heading", content: [{ type: "text", text: "1. 서론" }] },
          { type: "paragraph", content: [{ type: "text", text: "본문" }] },
          { type: "heading", content: [{ type: "text", text: "2. 방법" }] },
        ],
      }),
    ).toEqual(["1. 서론", "2. 방법"]);
    expect(
      folderPath(
        [
          { id: "a", title: "선행연구" } as never,
          { id: "b", title: "국내", parentId: "a" } as never,
        ],
        "b",
      ),
    ).toBe("선행연구 › 국내");
  });
});
