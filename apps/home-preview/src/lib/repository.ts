import { assertConnected, supabase } from "./supabase";
import { buildDemo } from "./demo";
import {
  emptyWorkspace,
  now,
  uid,
  type AIInput,
  type AIResult,
  type EntityKind,
  type EntityMap,
  type Material,
  type MaterialVersion,
  type ReviewRound,
  type WorkspaceData,
} from "./domain";
const DB_NAME = "rms-preview-v1";
export function previewDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore("workspace");
      db.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("브라우저의 미리보기 저장소를 열지 못했습니다."));
  });
}
export async function idbGet<T>(
  store: string,
  key: string,
): Promise<T | undefined> {
  const db = await previewDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
export async function idbSet(
  store: string,
  key: string,
  value: unknown,
): Promise<void> {
  const db = await previewDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function loadPreview() {
  let data = await idbGet<WorkspaceData>("workspace", "current");
  if (!data) {
    data = buildDemo();
    await idbSet("workspace", "current", data);
  }
  return { ...emptyWorkspace(), ...data };
}
// A single read/write transaction also serializes edits from other preview tabs.
export async function updatePreview(
  change: (data: WorkspaceData) => void,
): Promise<WorkspaceData> {
  await loadPreview();
  const db = await previewDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspace", "readwrite"),
      store = tx.objectStore("workspace");
    let next: WorkspaceData;
    const request = store.get("current");
    request.onsuccess = () => {
      try {
        next = structuredClone({
          ...emptyWorkspace(),
          ...(request.result ?? {}),
        });
        change(next);
        store.put(next, "current");
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(next);
    };
    tx.onabort = () => {
      db.close();
      reject(
        tx.error ?? new Error("저장하지 못했습니다. 작성한 내용은 유지됩니다."),
      );
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await assertConnected()
    .rpc(name, args)
    .abortSignal(AbortSignal.timeout(25000));
  if (error)
    throw Object.assign(new Error(error.message), { code: error.code });
  return data as T;
}
export async function loadConnected(): Promise<WorkspaceData> {
  const data = await rpc<WorkspaceData>("rms_bootstrap");
  return { ...emptyWorkspace(), ...data };
}
export class UploadConnectionError extends Error {
  uploadedVersion: MaterialVersion;
  constructor(version: MaterialVersion) {
    super(
      "파일 업로드는 끝났지만 자료에 연결하지 못했습니다. 파일을 다시 올리지 않고 연결만 다시 시도할 수 있습니다.",
    );
    this.name = "UploadConnectionError";
    this.uploadedVersion = version;
  }
}
export function validatePDF(file: File) {
  if (
    !/\.pdf$/i.test(file.name) ||
    (file.type && file.type !== "application/pdf")
  )
    throw new Error("PDF 파일을 선택해 주세요.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("20MB 이하의 PDF를 선택해 주세요.");
  if (file.size === 0)
    throw new Error("내용이 없는 파일은 등록할 수 없습니다.");
}
export async function validatePDFHeader(file: File) {
  validatePDF(file);
  const header = await file.slice(0, 5).text();
  if (header !== "%PDF-")
    throw new Error(
      "PDF 형식을 확인할 수 없습니다. 다른 PDF 파일을 선택해 주세요.",
    );
}
export async function uploadFile(
  file: File,
  material: Material,
  userId: string,
  mode: "preview" | "connected",
  onProgress?: (n: number) => void,
  signal?: AbortSignal,
): Promise<MaterialVersion> {
  await validatePDFHeader(file);
  if (signal?.aborted) throw new DOMException("취소했습니다.", "AbortError");
  const id = uid(),
    time = now();
  const version: MaterialVersion = {
    id,
    researchId: material.researchId,
    materialId: material.id,
    number: 0,
    fileName: file.name,
    storagePath: `${userId}/${material.researchId}/${id}.pdf`,
    size: file.size,
    mimeType: "application/pdf",
    createdAt: time,
    updatedAt: time,
  };
  if (mode === "preview") {
    await idbSet("files", version.storagePath, file);
    onProgress?.(100);
    return version;
  }
  const client = assertConnected();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session)
    throw new Error("로그인이 만료되었습니다. 다시 로그인해 주세요.");
  const token = data.session.access_token;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let complete = false;
    const abort = () => xhr.abort();
    xhr.open(
      "POST",
      `${url}/storage/v1/object/research-files/${version.storagePath}`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    const cleanup = () => {
      complete = true;
      signal?.removeEventListener("abort", abort);
    };
    xhr.onload = () => {
      cleanup();
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new Error("파일을 업로드하지 못했습니다. 다시 시도해 주세요."),
          );
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("연결이 끊겨 파일 업로드를 마치지 못했습니다."));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("업로드를 취소했습니다.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted && !complete) {
      cleanup();
      reject(new DOMException("취소했습니다.", "AbortError"));
      return;
    }
    xhr.send(file);
  });
  return version;
}
export async function getFile(
  version: MaterialVersion,
  mode: "preview" | "connected",
): Promise<Blob> {
  if (mode === "preview") {
    if (version.storagePath.startsWith("/demo/")) {
      const response = await fetch(version.storagePath);
      if (!response.ok) throw new Error("가상 PDF를 불러오지 못했습니다.");
      return response.blob();
    }
    const file = await idbGet<Blob>("files", version.storagePath);
    if (!file) throw new Error("이 브라우저에 저장된 파일을 찾을 수 없습니다.");
    return file;
  }
  const { data, error } = await assertConnected()
    .storage.from("research-files")
    .download(version.storagePath);
  if (error)
    throw new Error(
      "파일을 열 수 없습니다. 공유 상태와 접근 계정을 확인해 주세요.",
    );
  return data;
}
export async function executeAI(
  input: AIInput,
  signal?: AbortSignal,
): Promise<AIResult> {
  const client = assertConnected();
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error("다시 로그인해 주세요.");
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assist`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify(input),
      signal,
    },
  );
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("AI 응답을 읽지 못했습니다. 작성한 내용은 유지됩니다.");
  }
  if (!response.ok)
    throw new Error(
      payload?.error?.message ??
        payload?.message ??
        payload?.error ??
        "AI 요청을 처리하지 못했습니다.",
    );
  return payload as AIResult;
}
export function snapshotForResult(
  data: WorkspaceData,
  requestId: string,
  itemId: string,
  resultId: string,
  number: number,
): ReviewRound {
  const result = data.results.find((item) => item.id === resultId);
  if (!result) throw new Error("수정 결과를 찾을 수 없습니다.");
  const version = data.versions.find((item) => item.id === result.versionId);
  if (!result.description.trim()) throw new Error("수정한 내용을 적어 주세요.");
  if (result.kind === "document" && (!version || !result.location.trim()))
    throw new Error("문서 검토에는 보존 파일과 확인 위치가 필요합니다.");
  return {
    id: uid(),
    requestId,
    itemId,
    number,
    title: result.title,
    description: result.description,
    feedbackExcerpt: data.feedback
      .filter((f) => result.feedbackIds.includes(f.id))
      .map((f) => f.body)
      .join("\n"),
    versionId: version?.id,
    fileName: version?.fileName,
    storagePath: version?.storagePath,
    location: result.location,
    createdAt: now(),
  };
}
export async function saveRecord<K extends EntityKind>(
  kind: K,
  value: EntityMap[K],
) {
  return rpc<EntityMap[K]>("rms_save_record", { p_kind: kind, p_value: value });
}
