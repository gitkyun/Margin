import { useWorkspace } from "./workspace";
import { rpc, idbGet, idbSet } from "./repository";
import { assertConnected } from "./supabase";
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
        throw new Error("미리보기에서는 이 기능을 쓸 수 없어요.");
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
  if (!file.size || file.size > 50 * 1024 * 1024)
    throw new Error(
      "파일을 올리지 못했어요. 내용이 있는 50MB 이하 파일만 올릴 수 있어요.",
    );
  if (mode === "preview") {
    await idbSet("files", path, file);
    return;
  }
  const client = assertConnected(),
    { data } = await client.auth.getSession();
  if (!data.session)
    throw new Error("로그인이 만료됐어요. 다시 로그인해 주세요.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const clean = () => signal?.removeEventListener("abort", abort);
    xhr.open(
      "POST",
      `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/research-private/${path}`,
    );
    xhr.setRequestHeader(
      "Authorization",
      `Bearer ${data.session!.access_token}`,
    );
    xhr.setRequestHeader(
      "apikey",
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    );
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        progress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      clean();
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new Error("파일을 올리지 못했어요. 잠시 후 다시 시도해 주세요."),
          );
    };
    xhr.onerror = () => {
      clean();
      reject(
        new Error(
          "파일을 올리다가 연결이 끊겼어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
        ),
      );
    };
    xhr.onabort = () => {
      clean();
      reject(new DOMException("취소했어요.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      clean();
      reject(new DOMException("취소했어요.", "AbortError"));
      return;
    }
    xhr.send(file);
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
        "이 브라우저에서 파일을 찾을 수 없어요. 미리보기에서 저장한 파일은 저장한 브라우저에서만 열 수 있어요.",
      );
    return b;
  }
  const { data, error } = await assertConnected()
    .storage.from("research-private")
    .download(record.storagePath);
  if (error) throw error;
  return data;
}
export const modeLabels: Record<string, string> = {
  organize_meeting: "미팅 정리",
  suggest_revisions: "수정 방법 제안",
  review_writing: "원고 검토",
  plan_research: "할 일 정리",
  read_material: "자료 읽기",
  ask_research: "연구 대화",
};
