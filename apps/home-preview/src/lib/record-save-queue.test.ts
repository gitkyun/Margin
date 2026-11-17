import { describe, expect, it, vi } from "vitest";
import {
  createRecordSaveQueue,
  isRecordConflict,
  type RecordSaveQueue,
} from "./record-save-queue";

interface Saved {
  id: string;
  updatedAt: string;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const conflict = () => Object.assign(new Error("changed"), { code: "40001" });

function makeQueue(): RecordSaveQueue<string> {
  return createRecordSaveQueue<string>({ isConflict: isRecordConflict });
}

const noReload = () => Promise.reject(new Error("reload not expected"));

describe("createRecordSaveQueue", () => {
  it("같은 id의 저장을 들어온 순서대로 하나씩 실행한다", async () => {
    const queue = makeQueue();
    const order: string[] = [];
    const first = deferred<Saved>();
    const a = queue.enqueue({
      id: "m1",
      updatedAt: "t0",
      reload: noReload,
      save: () => {
        order.push("a:start");
        return first.promise;
      },
    });
    const b = queue.enqueue({
      id: "m1",
      updatedAt: "t0",
      reload: noReload,
      save: async (updatedAt) => {
        order.push("b:start");
        return { id: "m1", updatedAt: `${updatedAt}+b` };
      },
    });
    await Promise.resolve();
    expect(order).toEqual(["a:start"]);
    first.resolve({ id: "m1", updatedAt: "t1" });
    await Promise.all([a, b]);
    expect(order).toEqual(["a:start", "b:start"]);
  });

  it("다른 id끼리는 서로 기다리지 않는다", async () => {
    const queue = makeQueue();
    const blocked = deferred<Saved>();
    void queue.enqueue({
      id: "m1",
      updatedAt: "t0",
      reload: noReload,
      save: () => blocked.promise,
    });
    const other = await queue.enqueue({
      id: "m2",
      updatedAt: "u0",
      reload: noReload,
      save: async () => ({ id: "m2", updatedAt: "u1" }),
    });
    expect(other.updatedAt).toBe("u1");
    expect(queue.hasPending("m1")).toBe(true);
    blocked.resolve({ id: "m1", updatedAt: "t1" });
  });

  it("다음 저장에 앞 저장 응답의 updatedAt을 넘긴다", async () => {
    const queue = makeQueue();
    const seen: string[] = [];
    const save = async (updatedAt: string): Promise<Saved> => {
      seen.push(updatedAt);
      return { id: "m1", updatedAt: `${updatedAt}'` };
    };
    await Promise.all([
      queue.enqueue({ id: "m1", updatedAt: "t0", reload: noReload, save }),
      queue.enqueue({ id: "m1", updatedAt: "stale", reload: noReload, save }),
      queue.enqueue({ id: "m1", updatedAt: "stale", reload: noReload, save }),
    ]);
    expect(seen).toEqual(["t0", "t0'", "t0''"]);
  });

  it("앞 저장이 실패해도 다음 저장은 진행하고 updatedAt은 그대로 둔다", async () => {
    const queue = makeQueue();
    const seen: string[] = [];
    const ok = async (updatedAt: string): Promise<Saved> => {
      seen.push(updatedAt);
      return { id: "m1", updatedAt: "t1" };
    };
    const a = queue.enqueue({ id: "m1", updatedAt: "t0", reload: noReload, save: ok });
    const b = queue.enqueue({
      id: "m1",
      updatedAt: "t0",
      reload: noReload,
      save: async (updatedAt) => {
        seen.push(updatedAt);
        throw new Error("network");
      },
    });
    const c = queue.enqueue({ id: "m1", updatedAt: "t0", reload: noReload, save: ok });
    await expect(a).resolves.toEqual({ id: "m1", updatedAt: "t1" });
    await expect(b).rejects.toThrow("network");
    await expect(c).resolves.toEqual({ id: "m1", updatedAt: "t1" });
    expect(seen).toEqual(["t0", "t1", "t1"]);
  });

  it("충돌이면 다시 불러온 updatedAt으로 한 번 다시 시도한다", async () => {
    const queue = makeQueue();
    const reload = vi.fn(async () => "server-t5");
    const save = vi.fn(async (updatedAt: string): Promise<Saved> => {
      if (updatedAt !== "server-t5") throw conflict();
      return { id: "m1", updatedAt: "t6" };
    });
    const saved = await queue.enqueue({ id: "m1", updatedAt: "t0", reload, save });
    expect(saved.updatedAt).toBe("t6");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(save.mock.calls.map(([u]) => u)).toEqual(["t0", "server-t5"]);
  });

  it("다시 시도해도 충돌이면 실패로 끝나고 더 시도하지 않는다", async () => {
    const queue = makeQueue();
    const reload = vi.fn(async () => "server-t5");
    const save = vi.fn(async (): Promise<Saved> => {
      throw conflict();
    });
    await expect(
      queue.enqueue({ id: "m1", updatedAt: "t0", reload, save }),
    ).rejects.toMatchObject({ code: "40001" });
    expect(save).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("충돌이 아닌 실패에는 다시 불러오지 않는다", async () => {
    const queue = makeQueue();
    const reload = vi.fn(async () => "server-t5");
    await expect(
      queue.enqueue({
        id: "m1",
        updatedAt: "t0",
        reload,
        save: async () => {
          throw new Error("denied");
        },
      }),
    ).rejects.toThrow("denied");
    expect(reload).not.toHaveBeenCalled();
  });

  it("hasPending과 pendingValues는 진행 중일 때 값을 주고 끝나면 비운다", async () => {
    const queue = makeQueue();
    const first = deferred<Saved>();
    const a = queue.enqueue({
      id: "m1",
      updatedAt: "t0",
      optimistic: "memo-a",
      reload: noReload,
      save: () => first.promise,
    });
    const b = queue.enqueue({
      id: "m1",
      updatedAt: "t0",
      optimistic: "memo-b",
      reload: noReload,
      save: async () => ({ id: "m1", updatedAt: "t2" }),
    });
    expect(queue.hasPending("m1")).toBe(true);
    expect(queue.hasPending("m2")).toBe(false);
    expect(queue.pendingValues("m1")).toEqual(["memo-a", "memo-b"]);
    expect(queue.pendingValues("m2")).toEqual([]);
    first.resolve({ id: "m1", updatedAt: "t1" });
    await a;
    await vi.waitFor(() => expect(queue.pendingValues("m1")).toEqual(["memo-b"]));
    await b;
    await vi.waitFor(() => expect(queue.hasPending("m1")).toBe(false));
    expect(queue.pendingValues("m1")).toEqual([]);
  });

  it("줄이 비면 그 id의 상태를 지워 다음 줄은 호출자의 updatedAt으로 시작한다", async () => {
    const queue = makeQueue();
    await queue.enqueue({
      id: "m1",
      updatedAt: "t0",
      reload: noReload,
      save: async () => ({ id: "m1", updatedAt: "t1" }),
    });
    await vi.waitFor(() => expect(queue.size()).toBe(0));
    const seen: string[] = [];
    await queue.enqueue({
      id: "m1",
      updatedAt: "fresh",
      reload: noReload,
      save: async (updatedAt) => {
        seen.push(updatedAt);
        return { id: "m1", updatedAt: "t2" };
      },
    });
    expect(seen).toEqual(["fresh"]);
    await vi.waitFor(() => expect(queue.size()).toBe(0));
  });

  it("실패로 줄이 끝나도 상태를 지운다", async () => {
    const queue = makeQueue();
    await expect(
      queue.enqueue({
        id: "m1",
        updatedAt: "t0",
        reload: noReload,
        save: async () => {
          throw new Error("network");
        },
      }),
    ).rejects.toThrow("network");
    await vi.waitFor(() => expect(queue.size()).toBe(0));
  });

  it("응답에 updatedAt 문자열이 없으면 실패로 알린다", async () => {
    const queue = makeQueue();
    await expect(
      queue.enqueue({
        id: "m1",
        updatedAt: "t0",
        reload: noReload,
        save: async () => ({ id: "m1" }) as unknown as Saved,
      }),
    ).rejects.toThrow(/updatedAt/);
  });
});

describe("isRecordConflict", () => {
  it("코드 40001만 충돌로 본다", () => {
    expect(isRecordConflict(conflict())).toBe(true);
    expect(isRecordConflict({ code: "40001" })).toBe(true);
    expect(isRecordConflict(new Error("40001"))).toBe(false);
    expect(isRecordConflict({ code: "PT409" })).toBe(false);
    expect(isRecordConflict(null)).toBe(false);
    expect(isRecordConflict("40001")).toBe(false);
  });
});
