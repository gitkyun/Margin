import { WRITTEN_MAX } from "./written-limits";

export type ImportResult =
  | { ok: true; text: string; fileName: string }
  | { ok: false; reason: "pdf" | "type" | "unreadable" | "too_long" };

/**
 * 파일에서 가져오기(IA v2 04 §7.3). TXT·MD만 UTF-8로 읽어 서면 피드백 창에 넣습니다.
 * 50,000자가 넘으면 잘라 넣지 않고 막습니다.
 */
export async function readImportFile(file: {
  name: string;
  type?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf")
    return { ok: false, reason: "pdf" };
  if (!name.endsWith(".txt") && !name.endsWith(".md"))
    return { ok: false, reason: "type" };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(
      await file.arrayBuffer(),
    );
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (!text.trim() || text.includes("\u0000"))
    return { ok: false, reason: "unreadable" };
  if (text.length > WRITTEN_MAX) return { ok: false, reason: "too_long" };
  return { ok: true, text, fileName: file.name };
}
