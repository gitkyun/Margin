import { t } from "@/lib/i18n";
import { localizeServerMessage } from "@/lib/server-messages";
import { rpc } from "./repository";
import { assertConnected } from "./supabase";

/** 연구 초대 메일(서버: rms_project_invites, Edge Function project-invite). */
export type ProjectInviteRole = "editor" | "advisor";
export type ProjectInviteStatus =
  "pending" | "accepted" | "expired" | "revoked";
/** 메일 발송 상태. 'sent'는 메일 서비스가 발송 요청을 받았다는 뜻이지, 도착이나 수락이 아닙니다. */
export type InviteEmailStatus = "queued" | "sent" | "failed";
export type InviteEmailFailure =
  | "not_configured"
  | "rate_limited"
  | "sender_not_verified"
  | "rejected"
  | "unavailable";

export interface ProjectInvite {
  id: string;
  researchId: string;
  email: string;
  role: ProjectInviteRole;
  status: ProjectInviteStatus;
  createdAt: string;
  expiresAt: string;
  emailStatus: InviteEmailStatus;
  lastSentAt: string;
  sendCount: number;
  invitedBy: string;
  invitedByName: string | null;
  canManage?: boolean;
}

export interface InvitePreview {
  email: string;
  role: ProjectInviteRole;
  /** closed: 연구가 휴지통에 있거나 초대한 사람이 연구에서 빠져 지금은 수락할 수 없음 */
  status: ProjectInviteStatus | "closed";
  expiresAt: string;
  researchName: string | null;
  invitedByName: string | null;
}

export interface InviteSendOutcome {
  invite: ProjectInvite;
  emailStatus: InviteEmailStatus;
  emailFailure: InviteEmailFailure | null;
  /** 초대받은 이메일로 로그인한 사람만 쓸 수 있는 수락 주소 */
  link: string;
}

export interface InviteAcceptance {
  researchId: string;
  role: ProjectInviteRole;
  already: boolean;
}

/** 수락 주소에 토큰을 싣는 쿼리 이름: /join?token=<토큰> */
export const JOIN_PARAM = "token";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
/** 메일 확인이나 로그인으로 화면을 떠났다 돌아와도 수락을 이어 가도록 이 브라우저에만 잠깐 둡니다. */
const PENDING_KEY = "margin-pending-join";
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function joinTokenFrom(value: string | null | undefined): string | null {
  const token = (value ?? "").trim();
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function joinPath(token: string): string {
  return `/join?${JOIN_PARAM}=${token}`;
}

export function rememberPendingJoin(token: string): void {
  try {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ token, until: Date.now() + PENDING_TTL_MS }),
    );
  } catch {
    // 저장이 막힌 브라우저에서는 메일의 링크를 다시 열면 됩니다.
  }
}

export function pendingJoin(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as {
      token?: unknown;
      until?: unknown;
    } | null;
    if (!saved || typeof saved.until !== "number" || saved.until < Date.now())
      return null;
    return joinTokenFrom(typeof saved.token === "string" ? saved.token : null);
  } catch {
    return null;
  }
}

export function forgetPendingJoin(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // 지우지 못해도 수락된 토큰은 다시 쓸 수 없습니다.
  }
}

export function roleLabel(role: ProjectInviteRole): string {
  return role === "advisor" ? t("지도교수") : t("공동연구자");
}

/** 메일이 가지 않았을 때 초대한 사람에게 보여 줄 말. 다음에 할 일을 함께 알려 줍니다. */
export function emailFailureMessage(reason: InviteEmailFailure | null): string {
  if (reason === "rate_limited")
    return t(
      "메일을 보내는 곳이 잠시 요청을 받지 않아요. 조금 뒤에 다시 보내거나, 초대 링크를 복사해 직접 전해 주세요.",
    );
  if (reason === "sender_not_verified" || reason === "not_configured")
    return t(
      "메일 발송이 아직 준비되지 않아 메일을 보내지 못했어요. 초대는 만들어졌으니, 초대 링크를 복사해 직접 전해 주세요.",
    );
  if (reason === "rejected")
    return t(
      "이 주소로는 메일을 보낼 수 없었어요. 이메일을 확인하거나, 초대 링크를 복사해 직접 전해 주세요.",
    );
  return t(
    "메일을 보내지 못했어요. 초대는 만들어졌으니, 다시 보내거나 초대 링크를 복사해 직접 전해 주세요.",
  );
}

async function invokeInvite(
  body: Record<string, unknown>,
): Promise<InviteSendOutcome> {
  const { data, error } = await assertConnected().functions.invoke(
    "project-invite",
    { body },
  );
  if (error) {
    let message = t("초대를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    try {
      const failure = await error.context?.json();
      if (failure?.error) message = localizeServerMessage(failure.error);
    } catch {
      // 응답을 읽지 못하면 위의 기본 문구를 씁니다.
    }
    throw new Error(message);
  }
  if (!data?.invite)
    throw new Error(
      t("초대 결과를 확인하지 못했어요. 초대 목록을 새로고침해 확인해 주세요."),
    );
  return data as InviteSendOutcome;
}

export function sendProjectInvite(input: {
  researchId: string;
  email: string;
  role: ProjectInviteRole;
}): Promise<InviteSendOutcome> {
  return invokeInvite({ action: "send", ...input });
}

export function resendProjectInvite(
  inviteId: string,
): Promise<InviteSendOutcome> {
  return invokeInvite({ action: "resend", inviteId });
}

export function listProjectInvites(
  researchId: string,
): Promise<ProjectInvite[]> {
  return rpc<ProjectInvite[]>("rms_project_invite_list", {
    p_research: researchId,
  });
}

export function revokeProjectInvite(id: string): Promise<ProjectInvite> {
  return rpc<ProjectInvite>("rms_project_invite_revoke", { p_id: id });
}

export function previewProjectInvite(
  token: string,
): Promise<InvitePreview | null> {
  return rpc<InvitePreview | null>("rms_project_invite_preview", {
    p_token: token,
  });
}

export function acceptProjectInvite(token: string): Promise<InviteAcceptance> {
  return rpc<InviteAcceptance>("rms_project_invite_accept", { p_token: token });
}
