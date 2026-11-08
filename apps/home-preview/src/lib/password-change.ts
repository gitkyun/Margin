import { assertConnected, createPasswordVerificationClient } from "./supabase";

import { validateNewPassword } from "./password-policy";

export async function changeAccountPassword(
  user: { id: string; email: string },
  current: string,
  next: string,
  confirmation: string,
) {
  const policyError = validateNewPassword(next);
  if (policyError) throw new Error(policyError);
  if (next !== confirmation) throw new Error("새 비밀번호가 서로 다릅니다.");
  if (current === next)
    throw new Error("현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
  const verifier = createPasswordVerificationClient();
  try {
    const result = await verifier.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (result.error || result.data.user?.id !== user.id)
      throw new Error("현재 비밀번호를 확인해 주세요.");
    const { error } = await assertConnected().auth.updateUser({
      password: next,
    });
    if (error) throw error;
  } finally {
    // Revoke only the temporary verification session, never the workspace session.
    await verifier.auth.signOut({ scope: "local" }).catch(() => {});
  }
}
