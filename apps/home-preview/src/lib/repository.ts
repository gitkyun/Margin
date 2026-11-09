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
import { localizeServerMessage } from "@/lib/server-messages";
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
      reject(
        new Error(
          "미리보기 기록을 열지 못했어요. 브라우저가 사이트 데이터 저장을 막고 있는지 확인해 주세요.",
        ),
      );
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
        tx.error ??
          new Error("저장하지 못했어요. 작성한 내용은 그대로 있어요."),
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
    throw Object.assign(new Error(localizeServerMessage(error.message)), {
      code: error.code,
    });
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
      "파일은 올렸지만 자료에 등록하지 못했어요. 파일을 다시 올리지 않고 등록만 다시 시도할 수 있어요.",
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
    throw new Error(
      "빈 파일은 올릴 수 없어요. 내용이 있는 PDF를 선택해 주세요.",
    );
}
export async function validatePDFHeader(file: File) {
  validatePDF(file);
  const header = await file.slice(0, 5).text();
  if (header !== "%PDF-")
    throw new Error("올바른 PDF 파일이 아니에요. 다른 PDF를 선택해 주세요.");
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
  if (signal?.aborted)
    throw new DOMException("업로드를 취소했어요.", "AbortError");
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
    throw new Error("로그인이 만료됐어요. 다시 로그인해 주세요.");
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
        : reject(new Error("파일을 올리지 못했어요. 다시 시도해 주세요."));
    };
    xhr.onerror = () => {
      cleanup();
      reject(
        new Error(
          "연결이 끊겨 파일을 끝까지 올리지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
        ),
      );
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("업로드를 취소했어요.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted && !complete) {
      cleanup();
      reject(new DOMException("업로드를 취소했어요.", "AbortError"));
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
      if (!response.ok)
        throw new Error(
          "가상 PDF를 불러오지 못했어요. 새로고침한 뒤 다시 열어 주세요.",
        );
      return response.blob();
    }
    const file = await idbGet<Blob>("files", version.storagePath);
    if (!file)
      throw new Error(
        "이 브라우저에서 파일을 찾을 수 없어요. 미리보기에서 올린 파일은 올린 브라우저에서만 열 수 있어요.",
      );
    return file;
  }
  const { data, error } = await assertConnected()
    .storage.from("research-files")
    .download(version.storagePath);
  if (error)
    throw new Error(
      "파일을 열 수 없어요. 공유 상태와 로그인한 계정을 확인해 주세요.",
    );
  return data;
}
export async function executeAI(
  input: AIInput,
  signal?: AbortSignal,
): Promise<AIResult> {
  const client = assertConnected();
  const { data } = await client.auth.getSession();
  if (!data.session)
    throw new Error("로그인이 만료됐어요. 다시 로그인해 주세요.");
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
    throw new Error("AI 응답을 읽지 못했어요. 작성한 내용은 그대로 있어요.");
  }
  if (!response.ok)
    throw new Error(
      localizeServerMessage(
        payload?.error?.message ??
          payload?.message ??
          payload?.error ??
          "AI 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
      ),
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
  if (!result) throw new Error("수정 결과를 찾을 수 없어요.");
  const version = data.versions.find((item) => item.id === result.versionId);
  if (!result.description.trim()) throw new Error("수정한 내용을 적어 주세요.");
  if (result.kind === "document" && (!version || !result.location.trim()))
    throw new Error("문서 수정은 파일과 볼 위치를 지정해 주세요.");
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
