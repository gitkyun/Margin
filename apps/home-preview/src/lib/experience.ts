import { t } from "@/lib/i18n";
import { useWorkspace } from "./workspace";
import { rpc, idbGet, idbSet } from "./repository";
import { assertConnected } from "./supabase";
import { downloadFromR2, uploadToR2 } from "./file-storage";
import type { Recording, Attachment } from "./domain";
export function useExperience() {
  const w = useWorkspace();
  return {
    ...w,
    async action<T = unknown>(
      name: string,
      input: Record<string, unknown> = {},
    ): Promise<T> {
      if (w.mode === "preview")
        throw new Error(t("미리보기에서는 이 기능을 쓸 수 없어요."));
      const result = await rpc<T>(name, { p_input: input });
      await w.refresh();
      return result;
    },
    async markEvent(id?: string) {
      if (w.mode === "connected") {
        await rpc("rms_mark_event", { p_id: id ?? null });
        await w.refresh();
      }
    },
    async cancelRun(id: string) {
      if (w.mode === "connected") {
        await rpc("rms_cancel_ai", { p_id: id });
        await w.refresh();
      }
    },
  };
}
export async function uploadPrivate(
  file: File,
  path: string,
  mode: "preview" | "connected",
  progress?: (n: number) => void,
  signal?: AbortSignal,
) {
  if (!file.size || file.size > 500 * 1024 * 1024)
    throw new Error(
      t(
        "파일을 올리지 못했어요. 내용이 있는 500MB 이하 파일만 올릴 수 있어요.",
      ),
    );
  if (mode === "preview") {
    await idbSet("files", path, file);
    return;
  }
  const client = assertConnected(),
    { data } = await client.auth.getSession();
  if (!data.session)
    throw new Error(t("로그인이 만료됐어요. 다시 로그인해 주세요."));
  await uploadToR2({
    bucket: "research-private",
    path,
    file,
    mimeType: file.type,
    token: data.session.access_token,
    onProgress: progress,
    signal,
  });
}
export async function privateBlob(
  record: Recording | Attachment,
  mode: "preview" | "connected",
): Promise<Blob> {
  if (mode === "preview") {
    const b = await idbGet<Blob>("files", record.storagePath);
    if (!b)
      throw new Error(
        t(
          "이 브라우저에서 파일을 찾을 수 없어요. 미리보기에서 저장한 파일은 저장한 브라우저에서만 열 수 있어요.",
        ),
      );
    return b;
  }
  const client = assertConnected();
  const { data: session } = await client.auth.getSession();
  if (!session.session)
    throw new Error(t("로그인이 만료됐어요. 다시 로그인해 주세요."));
  const stored = await downloadFromR2(
    "research-private",
    record.storagePath,
    session.session.access_token,
  );
  if (stored instanceof Blob) return stored;
  const { data, error } = await client.storage
    .from("research-private")
    .download(record.storagePath);
  if (error) {
    if (stored === "unreachable")
      throw new Error(
        t(
          "파일 서버에 연결하지 못했어요. 페이지를 새로고침하고, 광고 차단 같은 확장 프로그램이 막고 있지 않은지 확인해 주세요.",
        ),
      );
    throw error;
  }
  return data;
}
export const modeLabels: Record<string, string> = {
  organize_meeting: t("미팅 정리"),
  suggest_revisions: t("수정 방법 제안"),
  review_writing: t("원고 검토"),
  plan_research: t("할 일 정리"),
  read_material: t("자료 읽기"),
  ask_research: t("연구 대화"),
  propose_roadmap: t("투고일 계획 제안"),
};
