import { t } from "@/lib/i18n";

// Files live in Cloudflare R2 behind the Margin file Worker. Login and
// permission checks stay in Supabase: every request carries the Supabase
// access token and the Worker asks Supabase before reading or writing.
export const FILE_WORKER_URL: string =
  import.meta.env.VITE_FILE_WORKER_URL ||
  "https://margin-files.rlgus801-dad.workers.dev";
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
export type FileBucket = "research-files" | "research-private";

const PART_RETRIES = 3;
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException(t("업로드를 취소했어요."), "AbortError"));
      },
      { once: true },
    );
  });

class PartError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

async function call<T>(
  path: string,
  token: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${FILE_WORKER_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error(t("로그인이 만료됐어요. 다시 로그인해 주세요."));
    if (response.status === 403)
      throw new Error(t("이 연구에 파일을 올릴 권한이 없어요."));
    if (response.status === 413)
      throw new Error(t("500MB 이하 파일만 올릴 수 있어요."));
    throw new Error(t("파일을 올리지 못했어요. 다시 시도해 주세요."));
  }
  return response.json() as Promise<T>;
}

function sendPart(
  url: string,
  token: string,
  chunk: Blob,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal,
) {
  return new Promise<{ partNumber: number; etag: string }>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const clean = () => signal?.removeEventListener("abort", abort);
      xhr.open("PUT", url);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (e) => onProgress(e.loaded);
      xhr.onload = () => {
        clean();
        if (xhr.status >= 200 && xhr.status < 300)
          resolve(JSON.parse(xhr.responseText));
        else if (xhr.status === 401)
          reject(
            new PartError(
              t("로그인이 만료됐어요. 다시 로그인해 주세요."),
              false,
            ),
          );
        else if (xhr.status === 403 || xhr.status === 400)
          reject(
            new PartError(t("이 연구에 파일을 올릴 권한이 없어요."), false),
          );
        else
          reject(
            new PartError(
              t("파일을 올리지 못했어요. 다시 시도해 주세요."),
              true,
            ),
          );
      };
      xhr.onerror = () => {
        clean();
        reject(
          new PartError(
            t(
              "연결이 끊겨 파일을 끝까지 올리지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
            ),
            true,
          ),
        );
      };
      xhr.onabort = () => {
        clean();
        reject(new DOMException(t("업로드를 취소했어요."), "AbortError"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) {
        clean();
        reject(new DOMException(t("업로드를 취소했어요."), "AbortError"));
        return;
      }
      xhr.send(chunk);
    },
  );
}

/** Upload in parts. Each part retries itself on network or server errors. */
export async function uploadToR2(input: {
  bucket: FileBucket;
  path: string;
  file: Blob;
  mimeType: string;
  token: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}) {
  const { bucket, path, file, mimeType, token, onProgress, signal } = input;
  if (!file.size || file.size > MAX_UPLOAD_BYTES)
    throw new Error(t("500MB 이하 파일만 올릴 수 있어요."));
  const { uploadId, partSize } = await call<{
    uploadId: string;
    partSize: number;
  }>(
    "/upload/start",
    token,
    { bucket, path, size: file.size, mimeType },
    signal,
  );
  const parts: { partNumber: number; etag: string }[] = [];
  let done = 0;
  try {
    for (let start = 0, n = 1; start < file.size; start += partSize, n++) {
      const chunk = file.slice(start, Math.min(start + partSize, file.size));
      const url = `${FILE_WORKER_URL}/upload/part?${new URLSearchParams({
        bucket,
        path,
        uploadId,
        part: String(n),
      })}`;
      for (let attempt = 1; ; attempt++) {
        try {
          parts.push(
            await sendPart(
              url,
              token,
              chunk,
              (loaded) =>
                onProgress?.(
                  Math.min(99, Math.round(((done + loaded) / file.size) * 100)),
                ),
              signal,
            ),
          );
          break;
        } catch (error) {
          if (
            !(error instanceof PartError) ||
            !error.retryable ||
            attempt >= PART_RETRIES
          )
            throw error;
          await wait(1000 * attempt * attempt, signal);
        }
      }
      done += chunk.size;
    }
    await call(
      "/upload/complete",
      token,
      { bucket, path, uploadId, parts, size: file.size, mimeType },
      signal,
    );
    onProgress?.(100);
  } catch (error) {
    void call("/upload/abort", token, { bucket, path, uploadId }).catch(
      () => undefined,
    );
    throw error;
  }
}

/** Returns null when the file is not in R2 yet (still only in Supabase Storage). */
export async function downloadFromR2(
  bucket: FileBucket,
  path: string,
  token: string,
): Promise<Blob | null> {
  let response: Response;
  try {
    response = await fetch(
      `${FILE_WORKER_URL}/file?${new URLSearchParams({ bucket, path })}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    // Worker unreachable: the caller falls back to the original in Supabase.
    return null;
  }
  if (response.status === 404) {
    const body = await response.json().catch(() => null);
    if (body?.error?.code === "NOT_IN_R2") return null;
  }
  if (!response.ok)
    throw new Error(
      t("파일을 열 수 없어요. 공유 상태와 로그인한 계정을 확인해 주세요."),
    );
  return response.blob();
}
