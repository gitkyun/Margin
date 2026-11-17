import type {
  DocumentRecord,
  Material,
  MaterialFolder,
  MaterialVersion,
} from "./domain";

export type DocsKind = "all" | "writing" | "material";
export type DocsSort = "recent" | "name";

export type DocRow =
  | {
      kind: "writing";
      id: string;
      title: string;
      updatedAt: string;
      document: DocumentRecord;
    }
  | {
      kind: "material";
      id: string;
      title: string;
      updatedAt: string;
      material: Material;
      /** 가장 최근 판(링크는 없음) */
      latest?: MaterialVersion;
      versions: number;
    };

export interface DocsView {
  kind: DocsKind;
  /** 폴더 id, "archived"(보관함), ""(전체) */
  folder: string;
  /** 자료 종류(자료 보기에서만) */
  type?: Material["type"] | "link" | "";
  query?: string;
  sort?: DocsSort;
}

/**
 * 글·자료 한 목록(IA v2 05 §2). 글과 자료를 한 줄 꼴로 모으고 분류·폴더·찾기·순서를 적용합니다.
 */
export function docRows(
  data: {
    documents: DocumentRecord[];
    materials: Material[];
    versions: MaterialVersion[];
  },
  researchId: string,
  view: DocsView,
  matches: (text: string, query: string) => boolean = (text, query) =>
    text.toLowerCase().includes(query.toLowerCase()),
): DocRow[] {
  const archived = view.folder === "archived";
  const inFolder = (folderId?: string) =>
    archived || !view.folder || folderId === view.folder;
  const rows: DocRow[] = [];
  if (view.kind !== "material" && !view.type)
    for (const document of data.documents) {
      if (document.researchId !== researchId) continue;
      if (!!document.archivedAt !== archived) continue;
      if (!inFolder(document.folderId)) continue;
      rows.push({
        kind: "writing",
        id: document.id,
        title: document.title,
        updatedAt: document.updatedAt,
        document,
      });
    }
  if (view.kind !== "writing")
    for (const material of data.materials) {
      if (material.researchId !== researchId) continue;
      if (!!material.archivedAt !== archived) continue;
      if (!inFolder(material.folderId)) continue;
      if (view.type === "link" && !material.externalUrl) continue;
      if (view.type && view.type !== "link" && material.type !== view.type)
        continue;
      const versions = data.versions
        .filter((v) => v.materialId === material.id && !v.archivedAt)
        .sort((a, b) => b.number - a.number);
      const latest = versions[0];
      rows.push({
        kind: "material",
        id: material.id,
        title: material.title,
        updatedAt:
          latest && latest.createdAt > material.updatedAt
            ? latest.createdAt
            : material.updatedAt,
        material,
        latest,
        versions: versions.length,
      });
    }
  const query = view.query?.trim() ?? "";
  const found = query
    ? rows.filter((row) =>
        matches(
          `${row.title} ${row.kind === "material" ? (row.latest?.fileName ?? "") : ""}`,
          query,
        ),
      )
    : rows;
  return found.sort((a, b) =>
    view.sort === "name"
      ? a.title.localeCompare(b.title, "ko")
      : b.updatedAt.localeCompare(a.updatedAt),
  );
}

/** 분류 열의 수: 전체·글·자료·보관함 */
export function docCounts(
  data: { documents: DocumentRecord[]; materials: Material[] },
  researchId: string,
) {
  const docs = data.documents.filter((d) => d.researchId === researchId);
  const mats = data.materials.filter((m) => m.researchId === researchId);
  const writing = docs.filter((d) => !d.archivedAt).length;
  const material = mats.filter((m) => !m.archivedAt).length;
  return {
    all: writing + material,
    writing,
    material,
    archived:
      docs.filter((d) => d.archivedAt).length +
      mats.filter((m) => m.archivedAt).length,
  };
}

/** 폴더 이름 경로(상위 › 하위) */
export function folderPath(
  folders: readonly MaterialFolder[],
  id: string | undefined,
): string {
  const names: string[] = [];
  let current = folders.find((f) => f.id === id);
  for (let i = 0; current && i < 12; i++) {
    names.unshift(current.title);
    current = folders.find((f) => f.id === current!.parentId);
  }
  return names.join(" › ");
}

/** 글 본문 JSON에서 제목(heading)들을 뽑아 목차로 씁니다. */
export function documentOutline(content: unknown, limit = 12): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (out.length >= limit || !node || typeof node !== "object") return;
    const n = node as { type?: string; content?: unknown[]; text?: string };
    if (n.type === "heading") {
      const text = (n.content ?? [])
        .map((c) => (c as { text?: string }).text ?? "")
        .join("")
        .trim();
      if (text) out.push(text);
      return;
    }
    for (const child of n.content ?? []) walk(child);
  };
  walk(content);
  return out;
}
