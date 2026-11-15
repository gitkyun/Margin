import type { MaterialFolder } from "./domain";

/** 자료를 끌어 폴더로 옮길 때 dataTransfer에 싣는 형식 */
export const MATERIAL_DRAG_TYPE = "application/x-margin-material";

type FolderLink = Pick<MaterialFolder, "id" | "parentId">;

/** 폴더 아래의 모든 하위 폴더 id(자기 자신 제외). 순환이 있어도 멈춰요. */
export function folderDescendants(
  folders: readonly FolderLink[],
  id: string,
): Set<string> {
  const found = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    for (const folder of folders)
      if (
        folder.parentId === current &&
        !found.has(folder.id) &&
        folder.id !== id
      ) {
        found.add(folder.id);
        queue.push(folder.id);
      }
  }
  return found;
}

/** 상위 폴더로 고를 수 있는 폴더: 자기 자신과 그 하위 폴더는 빼요(순환 방지). */
export function parentFolderOptions<T extends FolderLink>(
  folders: readonly T[],
  id: string,
): T[] {
  const blocked = folderDescendants(folders, id);
  return folders.filter(
    (folder) => folder.id !== id && !blocked.has(folder.id),
  );
}

/** 최상위 폴더: 부모가 없거나 부모가 보관돼 목록에 없는 폴더 */
export function rootFolders<T extends FolderLink>(folders: readonly T[]): T[] {
  return folders.filter(
    (folder) =>
      !folder.parentId ||
      !folders.some((parent) => parent.id === folder.parentId),
  );
}
