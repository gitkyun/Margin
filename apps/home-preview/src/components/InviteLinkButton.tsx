import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { inviteLink } from "@/lib/invites";
import { assertConnected, friendlyError } from "@/lib/supabase";

interface InviteLinkButtonProps {
  label?: string;
  size?: "sm" | "default";
}

/**
 * 마진 가입 초대 링크를 만들어 클립보드에 복사합니다.
 * 메일은 보내지 않으므로, 복사한 링크를 메신저나 메일로 직접 전해야 합니다.
 */
export function InviteLinkButton({
  label = t("초대 링크 복사"),
  size = "sm",
}: InviteLinkButtonProps) {
  const [busy, setBusy] = useState(false);

  async function copy() {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await assertConnected().rpc("rms_create_invite");
      if (error) throw new Error(error.message);
      const link = inviteLink(window.location.origin, String(data.code));
      try {
        await navigator.clipboard.writeText(link);
        toast.success(t("초대 링크를 복사했어요. 14일 동안 쓸 수 있어요."));
      } catch {
        // 클립보드를 못 쓰는 브라우저에서는 링크를 보여 주고 직접 복사하게 합니다.
        toast.message(t("초대 링크를 직접 복사해 주세요."), {
          description: link,
          duration: 20000,
        });
      }
    } catch (failure) {
      toast.error(friendlyError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={busy}
      onClick={() => void copy()}
    >
      <Icon name="link" size={16} />
      {label}
    </Button>
  );
}
