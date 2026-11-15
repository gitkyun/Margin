import type { WorkspaceData } from "./domain";

/** 저장 공간 눈금 한 칸(파일 하나의 최대 크기와 같은 500MB, 바이트) */
export const STORAGE_TICK_BYTES = 524_288_000;

/** 서울 기준 달(YYYY-MM). 월간 사용량을 셀 때 씁니다. */
export function seoulMonthKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

export interface MonthlyAIUsage {
  total: number;
  complete: number;
  failed: number;
}

/**
 * 이번 달(서울 기준) 내가 실행한 AI 요청 수. 워크스페이스에 내려온 실행 기록만 세므로
 * 지금 열 수 있는 연구의 실행만 들어가요(휴지통에서 완전히 지운 연구는 빠짐).
 */
export function monthlyAIUsage(
  runs: WorkspaceData["aiRuns"],
  userId: string,
  monthKey: string,
): MonthlyAIUsage {
  const mine = runs.filter((run) => {
    if (run.userId !== userId) return false;
    const created = new Date(run.createdAt);
    return (
      !Number.isNaN(created.getTime()) && seoulMonthKey(created) === monthKey
    );
  });
  return {
    total: mine.length,
    complete: mine.filter((run) => run.status === "complete").length,
    failed: mine.filter((run) => run.status === "failed").length,
  };
}

export interface StorageUsage {
  bytes: number;
  files: number;
}

/**
 * 내가 소유한 연구에 올린 파일(자료 버전·녹음·첨부)의 크기 합. 기록에 적힌 실제 파일 크기만 더하고,
 * 크기가 없는 파일(검토 요청 PDF 등)은 셀 수 없어 뺍니다. 같은 저장 경로는 한 번만 셉니다.
 */
export function storageUsage(
  data: Pick<
    WorkspaceData,
    "researches" | "versions" | "recordings" | "attachments"
  >,
  userId: string,
): StorageUsage {
  const owned = new Set(
    data.researches.filter((r) => r.ownerId === userId).map((r) => r.id),
  );
  const seen = new Set<string>();
  let bytes = 0;
  for (const file of [
    ...data.versions,
    ...data.recordings,
    ...data.attachments,
  ]) {
    if (!owned.has(file.researchId)) continue;
    if (!Number.isFinite(file.size) || file.size <= 0) continue;
    const key = file.storagePath || `${file.researchId}:${file.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    bytes += file.size;
  }
  return { bytes, files: seen.size };
}

/** 게이지 눈금: 500MB 단위로 쓴 양을 넘는 가장 작은 칸까지(최소 한 칸). */
export function storageScale(bytes: number): { max: number; ticks: number[] } {
  const count = Math.max(1, Math.ceil(bytes / STORAGE_TICK_BYTES));
  const ticks = Array.from(
    { length: count },
    (_, index) => (index + 1) * STORAGE_TICK_BYTES,
  );
  return { max: count * STORAGE_TICK_BYTES, ticks };
}

/** 바이트를 읽기 쉬운 크기로(1024 단위, 소수 한 자리) */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded =
    value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unit]}`;
}
