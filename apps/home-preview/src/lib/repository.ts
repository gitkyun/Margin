import { currentLang, t } from "@/lib/i18n";
import { assertConnected, supabase } from "./supabase";
import {
  AI_NOT_CONFIGURED_CODE,
  AINotConfiguredError,
  markAINotConfigured,
} from "./ai-availability";
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
import {
  normalizeRoadmap,
  ROADMAP_MODE,
  type RoadmapPlan,
  type RoadmapProposal,
} from "../../supabase/functions/ai-assist/roadmap";
import { downloadFromR2, uploadToR2 } from "./file-storage";
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
          t(
            "미리보기 기록을 열지 못했어요. 브라우저가 사이트 데이터 저장을 막고 있는지 확인해 주세요.",
          ),
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
          new Error(t("저장하지 못했어요. 작성한 내용은 그대로 있어요.")),
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
      t(
        "파일은 올렸지만 자료에 등록하지 못했어요. 파일을 다시 올리지 않고 등록만 다시 시도할 수 있어요.",
      ),
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
    throw new Error(t("PDF 파일을 선택해 주세요."));
  if (file.size > 500 * 1024 * 1024)
    throw new Error(t("500MB 이하의 PDF를 선택해 주세요."));
  if (file.size === 0)
    throw new Error(
      t("빈 파일은 올릴 수 없어요. 내용이 있는 PDF를 선택해 주세요."),
    );
}
export async function validatePDFHeader(file: File) {
  validatePDF(file);
  const header = await file.slice(0, 5).text();
  if (header !== "%PDF-")
    throw new Error(t("올바른 PDF 파일이 아니에요. 다른 PDF를 선택해 주세요."));
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
    throw new DOMException(t("업로드를 취소했어요."), "AbortError");
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
    throw new Error(t("로그인이 만료됐어요. 다시 로그인해 주세요."));
  await uploadToR2({
    bucket: "research-files",
    path: version.storagePath,
    file,
    mimeType: "application/pdf",
    token: data.session.access_token,
    onProgress,
    signal,
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
          t("가상 PDF를 불러오지 못했어요. 새로고침한 뒤 다시 열어 주세요."),
        );
      return response.blob();
    }
    const file = await idbGet<Blob>("files", version.storagePath);
    if (!file)
      throw new Error(
        t(
          "이 브라우저에서 파일을 찾을 수 없어요. 미리보기에서 올린 파일은 올린 브라우저에서만 열 수 있어요.",
        ),
      );
    return file;
  }
  const client = assertConnected();
  const { data: session } = await client.auth.getSession();
  if (!session.session)
    throw new Error(t("로그인이 만료됐어요. 다시 로그인해 주세요."));
  const stored = await downloadFromR2(
    "research-files",
    version.storagePath,
    session.session.access_token,
  );
  if (stored instanceof Blob) return stored;
  // Not copied to R2 yet: read the original from Supabase Storage.
  const { data, error } = await client.storage
    .from("research-files")
    .download(version.storagePath);
  if (error)
    throw new Error(
      stored === "unreachable"
        ? t(
            "파일 서버에 연결하지 못했어요. 페이지를 새로고침하고, 광고 차단 같은 확장 프로그램이 막고 있지 않은지 확인해 주세요.",
          )
        : t("파일을 열 수 없어요. 공유 상태와 로그인한 계정을 확인해 주세요."),
    );
  return data;
}
export async function executeAI(
  input: AIInput,
  signal?: AbortSignal,
): Promise<AIResult> {
  return (await postAI(input, signal)) as unknown as AIResult;
}
export interface RoadmapProposalResult {
  runId?: string;
  roadmap: RoadmapProposal;
  model: string;
  createdAt: string;
}
/**
 * 투고일 기준 로드맵 제안. 서버가 검사한 계획을 화면에서 한 번 더 검사하고,
 * 날짜가 오늘~투고일을 벗어난 제안은 보여 주지 않습니다.
 */
export async function requestRoadmapProposal(
  input: {
    researchId: string;
    clientRunId: string;
    plan: RoadmapPlan;
    model?: string;
    thinking?: AIInput["thinking"];
  },
  signal?: AbortSignal,
): Promise<RoadmapProposalResult> {
  const payload = await postAI({ mode: ROADMAP_MODE, ...input }, signal);
  try {
    return {
      runId: typeof payload.runId === "string" ? payload.runId : undefined,
      model: String(payload.model ?? ""),
      createdAt: String(payload.createdAt ?? ""),
      roadmap: normalizeRoadmap(payload.roadmap, input.plan),
    };
  } catch (error) {
    throw new Error(localizeServerMessage((error as Error).message));
  }
}
/** Supabase DB가 있는 리전(싱가포르). 함수도 여기서 실행하도록 요청합니다. */
const AI_FUNCTION_REGION = "ap-southeast-1";
/** ai-assist 함수에 요청을 보냅니다. 화면 언어를 함께 보내 그 언어로 답하게 합니다. */
async function postAI(
  input: object,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const client = assertConnected();
  const { data } = await client.auth.getSession();
  if (!data.session)
    throw new Error(t("로그인이 만료됐어요. 다시 로그인해 주세요."));
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assist`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${data.session.access_token}`,
        // 함수를 DB와 같은 리전에서 실행해 기록 읽기·크레딧 처리 왕복을 리전 안으로 둡니다(작업 문서 5-1).
        "x-region": AI_FUNCTION_REGION,
      },
      body: JSON.stringify({ ...input, locale: currentLang() }),
      signal,
    },
  );
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(t("AI 응답을 읽지 못했어요. 작성한 내용은 그대로 있어요."));
  }
  if (!response.ok && payload?.error?.code === AI_NOT_CONFIGURED_CODE) {
    markAINotConfigured();
    throw new AINotConfiguredError();
  }
  if (!response.ok)
    throw new Error(
      localizeServerMessage(
        payload?.error?.message ??
          payload?.message ??
          payload?.error ??
          t("AI 요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요."),
      ),
    );
  return payload;
}
export function snapshotForResult(
  data: WorkspaceData,
  requestId: string,
  itemId: string,
  resultId: string,
  number: number,
): ReviewRound {
  const result = data.results.find((item) => item.id === resultId);
  if (!result) throw new Error(t("수정 결과를 찾을 수 없어요."));
  const version = data.versions.find((item) => item.id === result.versionId);
  if (!result.description.trim())
    throw new Error(t("수정한 내용을 적어 주세요."));
  if (result.kind === "document" && (!version || !result.location.trim()))
    throw new Error(t("문서 수정은 파일과 볼 위치를 지정해 주세요."));
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
