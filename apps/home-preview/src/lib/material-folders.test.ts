import { describe, expect, it } from "vitest";
import {
  folderDescendants,
  parentFolderOptions,
  rootFolders,
} from "./material-folders";

const folders = [
  { id: "a" },
  { id: "b", parentId: "a" },
  { id: "c", parentId: "b" },
  { id: "d" },
  { id: "orphan", parentId: "archived" },
];

describe("material folders", () => {
  it("finds every nested child", () => {
    expect([...folderDescendants(folders, "a")]).toEqual(["b", "c"]);
  });

  it("stops on a cycle", () => {
    const cyclic = [
      { id: "x", parentId: "y" },
      { id: "y", parentId: "x" },
    ];
    expect([...folderDescendants(cyclic, "x")]).toEqual(["y"]);
  });

  it("does not offer itself or its children as a parent", () => {
    expect(parentFolderOptions(folders, "a").map((f) => f.id)).toEqual([
      "d",
      "orphan",
    ]);
  });

  it("treats folders whose parent is missing as roots", () => {
    expect(rootFolders(folders).map((f) => f.id)).toEqual(["a", "d", "orphan"]);
  });
});
