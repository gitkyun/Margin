import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ErrorNotice, StatusBadge } from "@/components/common";
import { Segments } from "@/components/experience";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/domain";
import { t } from "@/lib/i18n";
import {
  emailFailureMessage,
  listProjectInvites,
  resendProjectInvite,
  revokeProjectInvite,
  roleLabel,
  sendProjectInvite,
  type InviteSendOutcome,
  type ProjectInvite,
  type ProjectInviteRole,
} from "@/lib/project-invites";
import { friendlyError } from "@/lib/supabase";

interface ProjectInvitesProps {
  researchId: string;
  /** 공동연구자 초대는 연구 소유자만 합니다. */
  canInviteEditor: boolean;
  /** 지도교수 초대는 소유자와 활성 참여자가 합니다. */
  canInviteAdvisor: boolean;
}

const STATUS_TONE = {
  pending: "amber",
  accepted: "green",
  expired: "neutral",
  revoked: "neutral",
} as const;

function statusLabel(status: ProjectInvite["status"]): string {
  if (status === "accepted") return t("수락함");
  if (status === "expired") return t("만료됨");
  if (status === "revoked") return t("취소함");
  return t("수락 대기");
}

function emailLabel(invite: ProjectInvite): string {
  if (invite.emailStatus === "sent")
    return t("메일 발송 요청함 · {when}", {
      when: formatDateTime(invite.lastSentAt),
    });
  if (invite.emailStatus === "failed") return t("메일을 보내지 못함");
  return t("메일 보내는 중");
}

async function copyLink(link: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(link);
    toast.success(
      t("초대 링크를 복사했어요. 초대받은 이메일로 로그인해야 쓸 수 있어요."),
    );
  } catch {
    // 클립보드를 못 쓰는 브라우저에서는 링크를 보여 주고 직접 복사하게 합니다.
    toast.message(t("초대 링크를 직접 복사해 주세요."), {
      description: link,
      duration: 20000,
    });
  }
}

/** 연구 초대 메일 보내기와 초대 목록(재발송·취소). 연구 설정의 공동연구자 탭에서 씁니다. */
export function ProjectInvites({
  researchId,
  canInviteEditor,
  canInviteAdvisor,
}: ProjectInvitesProps) {
  const client = useQueryClient();
  const [confirmDialog, confirm] = useConfirm();
  const queryKey = ["project-invites", researchId];
  const invites = useQuery({
    queryKey,
    queryFn: () => listProjectInvites(researchId),
    staleTime: 15000,
  });
  const roles: ProjectInviteRole[] = [
    ...(canInviteEditor ? (["editor"] as const) : []),
    ...(canInviteAdvisor ? (["advisor"] as const) : []),
  ];
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectInviteRole>(roles[0] ?? "advisor");
  const [busy, setBusy] = useState("");
  const [problem, setProblem] = useState("");
  const [latest, setLatest] = useState<InviteSendOutcome | null>(null);

  async function run(key: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setProblem("");
    try {
      await task();
    } catch (failure) {
      setProblem(friendlyError(failure));
    } finally {
      setBusy("");
      void client.invalidateQueries({ queryKey });
    }
  }

  function report(outcome: InviteSendOutcome) {
    setLatest(outcome);
    if (outcome.emailStatus === "sent")
      toast.success(
        t("{email}로 초대 메일 발송을 요청했어요.", {
          email: outcome.invite.email,
        }),
      );
    else toast.error(emailFailureMessage(outcome.emailFailure));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run("send", async () => {
      report(
        await sendProjectInvite({ researchId, email: email.trim(), role }),
      );
      setEmail("");
    });
  }

  const list = invites.data ?? [];

  return (
    <div className="project-invites">
      {confirmDialog}
      {roles.length > 0 && (
        <form onSubmit={submit}>
          <h3>{t("이메일로 초대")}</h3>
          {roles.length > 1 && (
            <Segments
              label={t("초대할 역할")}
              value={role}
              onChange={(next) => setRole(next as ProjectInviteRole)}
              options={roles.map((value) => ({
                value,
                label: roleLabel(value),
              }))}
            />
          )}
          <p className="settings-note">
            {role === "advisor"
              ? t(
                  "지도교수는 마진 계정만 열려요. 연구 기록은 보이지 않고, 검토를 요청한 항목과 연구 방향만 볼 수 있어요.",
                )
              : t(
                  "공동연구자는 이 연구의 공동 기록을 함께 보고 편집해요. 아직 가입하지 않은 사람도 초대할 수 있어요.",
                )}
          </p>
          <label className="field">
            {t("초대할 이메일")}
            <Input
              type="email"
              required
              maxLength={254}
              autoComplete="off"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setProblem("");
              }}
              aria-describedby={problem ? "project-invite-error" : undefined}
              placeholder={t("예: name@example.com")}
              disabled={busy === "send"}
            />
          </label>
          {problem && (
            <p id="project-invite-error" role="alert" className="form-error">
              {problem}
            </p>
          )}
          <div className="bottom-actions">
            <Button type="submit" disabled={!!busy || !email.trim()}>
              <Icon name="send" size={16} />
              {busy === "send" ? t("보내는 중") : t("초대 메일 보내기")}
            </Button>
          </div>
        </form>
      )}
      {latest && (
        <aside
          className={`project-invite-result ${latest.emailStatus === "sent" ? "" : "failed"}`}
          role="status"
        >
          <Icon
            name={latest.emailStatus === "sent" ? "check-circle" : "warning"}
            size={19}
          />
          <div>
            <strong>
              {latest.emailStatus === "sent"
                ? t("{email}로 초대 메일 발송을 요청했어요.", {
                    email: latest.invite.email,
                  })
                : t("{email} 초대는 만들었지만 메일을 보내지 못했어요.", {
                    email: latest.invite.email,
                  })}
            </strong>
            <p>
              {latest.emailStatus === "sent"
                ? t(
                    "상대방이 메일의 ‘초대 수락’을 눌러야 참여해요. 메일이 보이지 않으면 스팸함을 확인해 달라고 알려 주세요.",
                  )
                : emailFailureMessage(latest.emailFailure)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyLink(latest.link)}
          >
            <Icon name="link" size={16} />
            {t("초대 링크 복사")}
          </Button>
        </aside>
      )}
      <h3>{t("보낸 초대")}</h3>
      {invites.isLoading ? (
        <p role="status">{t("초대 목록을 불러오고 있어요.")}</p>
      ) : invites.isError ? (
        <ErrorNotice
          message={friendlyError(invites.error)}
          retry={() => void invites.refetch()}
        />
      ) : list.length === 0 ? (
        <p className="student-empty-inline">{t("아직 보낸 초대가 없어요.")}</p>
      ) : (
        <ul className="project-invite-list">
          {list.map((invite) => {
            const open =
              invite.status === "pending" || invite.status === "expired";
            return (
              <li key={invite.id} className="project-invite-row">
                <div className="project-invite-main">
                  <strong>{invite.email}</strong>
                  <small>
                    {roleLabel(invite.role)}
                    {" · "}
                    {t("{name}님이 {when}에 초대", {
                      name: invite.invitedByName ?? t("참여자"),
                      when: formatDateTime(invite.createdAt),
                    })}
                  </small>
                  <small
                    className={
                      open && invite.emailStatus === "failed"
                        ? "project-invite-warn"
                        : undefined
                    }
                  >
                    {invite.status === "pending"
                      ? t("{label} · {when}까지 수락할 수 있어요", {
                          label: emailLabel(invite),
                          when: formatDateTime(invite.expiresAt),
                        })
                      : invite.status === "expired"
                        ? t(
                            "{when}에 만료됐어요. 다시 보내면 새 링크가 가요.",
                            {
                              when: formatDateTime(invite.expiresAt),
                            },
                          )
                        : invite.status === "accepted"
                          ? t("초대를 수락했어요.")
                          : t("취소한 초대예요. 받은 링크는 쓸 수 없어요.")}
                  </small>
                </div>
                <StatusBadge tone={STATUS_TONE[invite.status]}>
                  {statusLabel(invite.status)}
                </StatusBadge>
                {open && invite.canManage && (
                  <div className="project-invite-actions">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!!busy}
                      onClick={() =>
                        void run(`resend:${invite.id}`, async () =>
                          report(await resendProjectInvite(invite.id)),
                        )
                      }
                    >
                      {busy === `resend:${invite.id}`
                        ? t("보내는 중")
                        : t("다시 보내기")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!!busy}
                      onClick={async () => {
                        if (
                          !(await confirm({
                            title: t(
                              "{email}님의 초대를 취소할까요? 이미 보낸 링크는 쓸 수 없게 돼요.",
                              { email: invite.email },
                            ),
                            confirmLabel: t("초대 취소"),
                            destructive: true,
                          }))
                        )
                          return;
                        void run(`revoke:${invite.id}`, async () => {
                          await revokeProjectInvite(invite.id);
                          setLatest((current) =>
                            current?.invite.id === invite.id ? null : current,
                          );
                          toast.success(t("초대를 취소했어요."));
                        });
                      }}
                    >
                      {t("초대 취소")}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
