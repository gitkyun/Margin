import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  verify: vi.fn(),
  update: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({
  assertConnected: () => ({ auth: { updateUser: auth.update } }),
  createPasswordVerificationClient: () => ({
    auth: { signInWithPassword: auth.verify, signOut: auth.signOut },
  }),
}));
import { changeAccountPassword } from "../src/lib/password-change";
const user = { id: "student", email: "student@example.test" };
beforeEach(() => {
  vi.clearAllMocks();
  auth.verify.mockResolvedValue({ data: { user }, error: null });
  auth.update.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
});
it("rejects mismatched or short passwords before any sign-in", async () => {
  await expect(
    changeAccountPassword(user, "old-secret", "short", "short"),
  ).rejects.toThrow("8자");
  await expect(
    changeAccountPassword(user, "old-secret", "new-secret", "different"),
  ).rejects.toThrow("서로 다릅니다");
  expect(auth.verify).not.toHaveBeenCalled();
  expect(auth.update).not.toHaveBeenCalled();
});
it("never updates the password when the verification belongs to a different user", async () => {
  auth.verify.mockResolvedValue({
    data: { user: { id: "someone-else" } },
    error: null,
  });
  await expect(
    changeAccountPassword(user, "old-secret", "new-secret", "new-secret"),
  ).rejects.toThrow("현재 비밀번호");
  expect(auth.update).not.toHaveBeenCalled();
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("updates only after current-password verification and closes only that temporary session", async () => {
  await changeAccountPassword(user, "old-secret", "new-secret", "new-secret");
  expect(auth.verify).toHaveBeenCalledWith({
    email: user.email,
    password: "old-secret",
  });
  expect(auth.update).toHaveBeenCalledWith({ password: "new-secret" });
  expect(auth.verify.mock.invocationCallOrder[0]).toBeLessThan(
    auth.update.mock.invocationCallOrder[0],
  );
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("surfaces update errors while still closing the verification session", async () => {
  auth.update.mockResolvedValue({ error: new Error("更新失敗") });
  await expect(
    changeAccountPassword(user, "old-secret", "new-secret", "new-secret"),
  ).rejects.toThrow();
  expect(auth.signOut).toHaveBeenCalledOnce();
});

it("accepts exactly eight characters without trimming the entered value", async () => {
  await changeAccountPassword(user, "old-secret", " pass12!", " pass12!");
  expect(auth.update).toHaveBeenCalledWith({ password: " pass12!" });
});
