import { describe, expect, it } from "vitest";
import { readImportFile } from "../src/lib/import-file";

const file = (name: string, bytes: Uint8Array | string, type = "") => ({
  name,
  type,
  arrayBuffer: async () =>
    (typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes)
      .buffer as ArrayBuffer,
});

describe("파일에서 가져오기(IA v2 04 §7.3)", () => {
  it("TXT·MD를 UTF-8로 읽는다", async () => {
    expect(await readImportFile(file("a.txt", "교수님 의견"))).toEqual({
      ok: true,
      text: "교수님 의견",
      fileName: "a.txt",
    });
    expect((await readImportFile(file("B.MD", "# 제목"))).ok).toBe(true);
  });
  it("형식·글자·길이로 막는다", async () => {
    const reason = async (f: ReturnType<typeof file>) => {
      const result = await readImportFile(f);
      return result.ok ? "ok" : result.reason;
    };
    expect(await reason(file("a.pdf", "x"))).toBe("pdf");
    expect(await reason(file("a", "x", "application/pdf"))).toBe("pdf");
    expect(await reason(file("a.docx", "x"))).toBe("type");
    expect(await reason(file("a.txt", new Uint8Array([0xb1, 0xb3])))).toBe(
      "unreadable",
    );
    expect(await reason(file("a.txt", "  "))).toBe("unreadable");
    expect(await reason(file("a.txt", "가".repeat(50_001)))).toBe("too_long");
    expect(await reason(file("a.txt", "가".repeat(50_000)))).toBe("ok");
  });
});
