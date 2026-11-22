import { t } from "@/lib/i18n";
import { useState } from "react";
import { SlideToConfirm } from "./SlideToConfirm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace";
import { assertConnected, friendlyError } from "@/lib/supabase";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "./ui/dialog";
import { Icon } from "./icons";
import { toast } from "sonner";
import { localizeServerMessage } from "@/lib/server-messages";

export function PermanentResearchDelete({
  id,
  name,
  retry = false,
}: {
  id: string;
  name: string;
  retry?: boolean;
}) {
  const w = useWorkspace();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  /**
   * 슬라이드를 끝까지 밀면 서버에서 삭제합니다. 서버는 소유자·휴지통 상태를 다시 확인하고
   * 확인 값으로 연구 이름을 받으므로, 화면에 보이는 이 연구의 이름을 그대로 넘겨요.
   */
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (w.mode !== "connected")
        throw new Error(t("미리보기에서는 완전히 삭제할 수 없어요."));
      const { data, error } = await assertConnected().functions.invoke(
        "delete-research",
        { body: { researchId: id, confirmationName: name } },
      );
      if (error) {
        let message = t("삭제하지 못했어요. 다시 시도해 주세요.");
        try {
          const body = await error.context?.json();
          if (body?.error) message = localizeServerMessage(body.error);
        } catch {
          /* Use safe fallback. */
        }
        throw new Error(message);
      }
      if (!data?.deleted)
        throw new Error(
          data?.error ??
            t(
              "삭제 결과를 확인하지 못했어요. 새로고침한 뒤 휴지통을 확인해 주세요.",
            ),
        );
      await w.refresh();
      setOpen(false);
      toast.success(t("연구와 올린 파일을 완전히 삭제했어요."));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      void client.invalidateQueries({
        queryKey: ["pending-deletions", w.user.id],
      });
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(true);
          setError("");
        }}
      >
        <Icon name="trash" size={16} />
        {retry ? t("삭제 마무리") : t("완전히 삭제")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent
          className="rms-dialog"
          showCloseButton={!busy}
          disableEscapeKeyDownClose={busy}
          disableOutsideClickClose={busy}
        >
          <DialogHeader>
            <DialogTitle>{t("연구를 완전히 삭제할까요?")}</DialogTitle>
            <DialogDescription>
              {t(
                "‘{name}’의 미팅, 원고, 자료, 녹음, 검토 기록과 올린 파일을 모두 삭제해요. 공동연구자가 남긴 기록도 함께 삭제되고 되돌릴 수 없어요. 이미 내려받은 파일은 지워지지 않아요.",
                { name },
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <SlideToConfirm
              tone="danger"
              label={t("밀어서 완전히 삭제")}
              confirmLabel={t("삭제 중")}
              disabled={busy}
              onConfirm={remove}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {t("취소")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function PendingResearchDeletions() {
  const { user, mode } = useWorkspace();
  const jobs = useQuery({
    queryKey: ["pending-deletions", user.id],
    enabled: mode === "connected",
    queryFn: async () => {
      const { data, error } = await assertConnected().rpc(
        "rms_pending_deletions",
      );
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
  if (jobs.isError)
    return (
      <div className="pending-deletions" role="alert">
        {t("파일 삭제가 남은 연구를 불러오지 못했어요.")}{" "}
        <Button variant="link" onClick={() => void jobs.refetch()}>
          {t("다시 불러오기")}
        </Button>
      </div>
    );
  if (!jobs.data?.length) return null;
  return (
    <section className="pending-deletions">
      <h2>{t("파일 삭제가 남은 연구")}</h2>
      <p>
        {t(
          "기록은 삭제했지만 올린 파일이 남아 있을 수 있어요. 삭제를 마무리해 주세요.",
        )}
      </p>
      {jobs.data.map((job) => (
        <div key={job.id}>
          <strong>{job.name}</strong>
          <PermanentResearchDelete {...job} retry />
        </div>
      ))}
    </section>
  );
}
