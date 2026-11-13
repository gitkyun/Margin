// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  admit,
  finishSocialLogin,
  safeNext,
  takeSocialProblem,
} from "./social-login";

function fakeClient(overrides: Record<string, unknown> = {}) {
  const setSession = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const client = { auth: { setSession }, rpc, ...overrides };
  return { client: client as unknown as SupabaseClient, setSession, rpc };
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/r");
  takeSocialProblem();
});

describe("safeNext", () => {
  it("keeps addresses inside the app", () => {
    expect(safeNext("/r/abc")).toBe("/r/abc");
    expect(safeNext("/join?token=1")).toBe("/join?token=1");
  });

  it("falls back to the research list for anything else", () => {
    expect(safeNext("//evil.example")).toBe("/r");
    expect(safeNext("https://evil.example")).toBe("/r");
    expect(safeNext("/login")).toBe("/r");
    expect(safeNext(null)).toBe("/r");
  });
});

describe("finishSocialLogin", () => {
  it("does nothing on an ordinary address", async () => {
    const { client, setSession } = fakeClient();
    expect(await finishSocialLogin(client)).toEqual({ handled: false });
    expect(setSession).not.toHaveBeenCalled();
  });

  it("signs in with the returned tokens and clears them from the address", async () => {
    window.history.replaceState(
      null,
      "",
      "/r?keep=1#access_token=aaa&refresh_token=bbb&token_type=bearer",
    );
    const { client, setSession } = fakeClient();
    expect(await finishSocialLogin(client)).toEqual({ handled: true });
    expect(setSession).toHaveBeenCalledWith({
      access_token: "aaa",
      refresh_token: "bbb",
    });
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?keep=1");
  });

  it("keeps a readable problem for the login screen when the provider fails", async () => {
    window.history.replaceState(
      null,
      "",
      "/r?error=server_error&error_code=unexpected_failure#error=server_error&error_description=Error+getting+user+email+from+external+provider",
    );
    const { client, setSession } = fakeClient();
    const result = await finishSocialLogin(client);
    expect(result.handled).toBe(true);
    expect(result.problem).toContain("이메일");
    expect(setSession).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
    expect(takeSocialProblem()).toBe(result.problem);
    expect(takeSocialProblem()).toBe("");
  });
});

describe("admit", () => {
  it("asks the server once per account in this browser", async () => {
    const { client, rpc } = fakeClient();
    await admit(client, "user-1");
    await admit(client, "user-1");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("rms_join");
  });

  it("asks again next time when the server refused", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: "nope" } });
    const { client } = fakeClient({ rpc });
    await admit(client, "user-2");
    await admit(client, "user-2");
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
