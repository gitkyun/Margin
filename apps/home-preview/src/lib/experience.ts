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
        throw new Error("계정에 로그인한 뒤 사용할 수 있습니다.");
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
    throw new Error("50MB 이하의 파일을 선택해 주세요.");
  if (mode === "preview") {
    await idbSet("files", path, file);
    return;
  }
  const client = assertConnected(),
    { data } = await client.auth.getSession();
  if (!data.session) throw new Error("다시 로그인해 주세요.");
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
        : reject(new Error("업로드하지 못했습니다. 다시 시도해 주세요."));
    };
    xhr.onerror = () => {
      clean();
      reject(new Error("파일 전송이 중단되었습니다."));
    };
    xhr.onabort = () => {
      clean();
      reject(new DOMException("취소했습니다.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      clean();
      reject(new DOMException("취소했습니다.", "AbortError"));
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
    if (!b) throw new Error("파일을 찾을 수 없습니다.");
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
  suggest_revisions: "수정 방안",
  review_writing: "원고 검토",
  plan_research: "연구 계획",
  read_material: "자료 읽기",
  ask_research: "연구 대화",
};
