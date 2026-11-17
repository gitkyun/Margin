// 같은 기록(id)에 대한 저장을 한 줄로 세워 차례로 보낸다(IA v2 08 §6).
// 다음 저장은 앞 저장 응답의 updatedAt을 싣고, 충돌(40001)이면 그 기록의
// updatedAt을 다시 읽어 한 번만 다시 시도한다. 다른 id끼리는 서로 기다리지 않는다.

const CONFLICT_CODE = "40001";

export interface SavedRecord {
  updatedAt: string;
}

export interface RecordSaveJob<V, T extends SavedRecord> {
  id: string;
  /** 줄이 비어 있을 때 첫 저장에 쓰는 updatedAt. 줄에 앞 저장이 있으면 그 응답 값을 쓴다. */
  updatedAt: string;
  /** 저장이 끝나기 전까지 화면에 다시 덮을 낙관적 값(다시 불러온 결과 위에). */
  optimistic?: V;
  save: (updatedAt: string) => Promise<T>;
  /** 충돌일 때 서버의 지금 updatedAt을 읽는다. */
  reload: () => Promise<string>;
}

export interface RecordSaveQueue<V> {
  enqueue<T extends SavedRecord>(job: RecordSaveJob<V, T>): Promise<T>;
  hasPending(id: string): boolean;
  pendingValues(id: string): V[];
  /** 저장이 남아 있는 기록 수. */
  size(): number;
}

interface PendingEntry<V> {
  optimistic?: V;
  hasOptimistic: boolean;
}

interface Lane<V> {
  updatedAt: string;
  tail: Promise<unknown>;
  pending: PendingEntry<V>[];
}

export function isRecordConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (error as { code?: unknown }).code === CONFLICT_CODE;
}

function assertSaved<T extends SavedRecord>(saved: T): T {
  if (typeof saved?.updatedAt !== "string") {
    // i18n-ignore: 개발자용 오류(화면 문구 아님). 화면은 friendlyError로 바꿔 보여 줍니다.
    throw new Error("저장 응답에 updatedAt이 없습니다.");
  }
  return saved;
}

export function createRecordSaveQueue<V>(options: {
  isConflict: (error: unknown) => boolean;
}): RecordSaveQueue<V> {
  const lanes = new Map<string, Lane<V>>();

  async function saveWithRetry<T extends SavedRecord>(
    lane: Lane<V>,
    job: RecordSaveJob<V, T>,
  ): Promise<T> {
    try {
      return assertSaved(await job.save(lane.updatedAt));
    } catch (error) {
      if (!options.isConflict(error)) throw error;
      const fresh = await job.reload();
      return assertSaved(await job.save(fresh));
    }
  }

  function finish(id: string, lane: Lane<V>, entry: PendingEntry<V>) {
    lane.pending = lane.pending.filter((item) => item !== entry);
    if (lane.pending.length === 0 && lanes.get(id) === lane) lanes.delete(id);
  }

  function enqueue<T extends SavedRecord>(
    job: RecordSaveJob<V, T>,
  ): Promise<T> {
    const lane = lanes.get(job.id) ?? {
      updatedAt: job.updatedAt,
      tail: Promise.resolve(),
      pending: [],
    };
    lanes.set(job.id, lane);
    const entry: PendingEntry<V> = {
      optimistic: job.optimistic,
      hasOptimistic: "optimistic" in job,
    };
    lane.pending = [...lane.pending, entry];

    const run = lane.tail.then(async () => {
      try {
        const saved = await saveWithRetry(lane, job);
        lane.updatedAt = saved.updatedAt;
        return saved;
      } finally {
        finish(job.id, lane, entry);
      }
    });
    // 앞 저장의 실패가 다음 저장을 막지 않게, 줄의 꼬리는 결과와 상관없이 이어 간다.
    lane.tail = run.catch(() => undefined);
    return run;
  }

  return {
    enqueue,
    hasPending: (id) => (lanes.get(id)?.pending.length ?? 0) > 0,
    pendingValues: (id) =>
      (lanes.get(id)?.pending ?? [])
        .filter((entry) => entry.hasOptimistic)
        .map((entry) => entry.optimistic as V),
    size: () => lanes.size,
  };
}
