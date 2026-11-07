import { useState } from "react";
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
} from "./ui/dialog";
import { Icon } from "./icons";
import { toast } from "sonner";

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
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => {
          setOpen(true);
          setConfirmation("");
          setError("");
        }}
      >
        <Icon name="trash" size={16} />
        {retry ? "삭제 마무리" : "완전히 삭제"}
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
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>연구를 완전히 삭제할까요?</DialogTitle>
            <DialogDescription>
              ‘{name}’의 미팅·원고·자료·녹음·검토 기록과 보존 파일을 삭제합니다.
              공동연구자의 기록도 포함되며 복원할 수 없습니다. 이미 내려받은
              파일은 삭제되지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || confirmation !== name) return;
              setBusy(true);
              setError("");
              try {
                if (w.mode !== "connected")
                  throw new Error("로그인한 계정에서 삭제할 수 있습니다.");
                const { data, error } =
                  await assertConnected().functions.invoke("delete-research", {
                    body: { researchId: id, confirmationName: confirmation },
                  });
                if (error) {
                  let message =
                    "삭제를 완료하지 못했습니다. 휴지통에서 다시 시도해 주세요.";
                  try {
                    const body = await error.context?.json();
                    if (body?.error) message = body.error;
                  } catch {
                    /* Use safe fallback. */
                  }
                  throw new Error(message);
                }
                if (!data?.deleted)
                  throw new Error(
                    data?.error ?? "삭제 결과를 확인하지 못했습니다.",
                  );
                await w.refresh();
                setOpen(false);
                setConfirmation("");
                toast.success("연구와 보존 파일을 완전히 삭제했습니다.");
              } catch (e) {
                setError(friendlyError(e));
              } finally {
                setBusy(false);
                void client.invalidateQueries({
                  queryKey: ["pending-deletions", w.user.id],
                });
              }
            }}
          >
            <label className="field">
              확인을 위해 연구 이름을 입력하세요
              <input
                className="rms-input"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                disabled={busy}
                required
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="settings-form-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                취소
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={busy || confirmation !== name}
              >
                {busy ? "삭제 중" : "완전히 삭제"}
              </Button>
            </div>
          </form>
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
        삭제 처리 내역을 불러오지 못했습니다.{" "}
        <button className="text-link" onClick={() => void jobs.refetch()}>
          다시 확인
        </button>
      </div>
    );
  if (!jobs.data?.length) return null;
  return (
    <section className="pending-deletions">
      <h2>파일 정리가 필요한 연구</h2>
      <p>기록의 접근은 중지되었습니다. 남은 파일 삭제를 마무리하세요.</p>
      {jobs.data.map((job) => (
        <div key={job.id}>
          <strong>{job.name}</strong>
          <PermanentResearchDelete {...job} retry />
        </div>
      ))}
    </section>
  );
}
