import { useEffect, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { useDisabledReason } from "@/components/common";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canNotifyAgain,
  readNotifyRecord,
  requestReviewNotify,
  reviewNotifyAvailable,
  type NotifyRecord,
} from "@/lib/review-notify";
import { timeText } from "./helpers";

interface ReviewNotifyBarProps {
  requestId: string;
  requestTitle?: string;
  professorEmail: string;
  status: "draft" | "shared" | "stopped";
  /** 서버 연결 전 미리보기면 보낼 수 없어요. */
  preview: boolean;
}

/**
 * 학생이 원할 때만 누르는 ‘교수님께 메일로도 알리기’.
 * 검토 링크를 만든 것만으로는 아무것도 보내지 않아요(링크 생성 ≠ 전송).
 * 보내기 전에 수신자·제목·내용을 확인하는 이메일 초안 미리보기를 거쳐요.
 * 보낸 뒤에도 ‘메일 발송 요청함’까지만 말하고 도착했다고 하지 않아요.
 */
export function ReviewNotifyBar({
  requestId,
  requestTitle,
  professorEmail,
  status,
  preview,
}: ReviewNotifyBarProps) {
  const [available, setAvailable] = useState<boolean | null>(
    preview ? false : null,
  );
  const [record, setRecord] = useState<NotifyRecord | null>(() =>
    readNotifyRecord(requestId),
  );
  const [busy, setBusy] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  useEffect(() => {
    setRecord(readNotifyRecord(requestId));
  }, [requestId]);
  useEffect(() => {
    if (preview) return;
    let active = true;
    void reviewNotifyAvailable().then((value) => {
      if (active) setAvailable(value);
    });
    return () => {
      active = false;
    };
  }, [preview]);
  const waiting = !canNotifyAgain(record);
  const reason = preview
    ? t("미리보기에서는 메일을 보낼 수 없어요.")
    : status !== "shared"
      ? t("공유를 중지한 검토 요청은 메일로 알릴 수 없어요.")
      : available === false
        ? t(
            "메일 발송이 아직 준비되지 않았어요. 링크를 복사해 교수님께 직접 전해 주세요.",
          )
        : waiting && record
          ? t("{time} 이후에 다시 알릴 수 있어요.", {
              time: timeText(record.nextAt),
            })
          : "";
  const disabledReason = useDisabledReason(!busy && reason);
  const displayTitle = requestTitle?.trim() || t("검토 요청");
  const reviewUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/reviews/${requestId}`
      : `/reviews/${requestId}`;
  async function send() {
    if (busy || reason) return;
    setBusy(true);
    try {
      const next = await requestReviewNotify(requestId);
      setRecord(next);
      setDraftOpen(false);
      toast.success(
        t("메일 발송을 요청했어요. 도착 여부는 이 화면에서 알 수 없어요."),
      );
    } catch (failure) {
      toast.error(
        failure instanceof Error
          ? failure.message
          : t("메일 발송을 요청하지 못했어요. 잠시 뒤 다시 시도해 주세요."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="review-notify-bar">
        <Icon name="send" size={16} />
        <div className="review-notify-text">
          {record ? (
            <p role="status" key={record.requestedAt} className="text-swap">
              <strong>{t("메일 발송 요청함")}</strong>
              {" · "}
              {timeText(record.requestedAt)}
              <small>{t("도착 여부는 알 수 없어요.")}</small>
            </p>
          ) : (
            <p>
              {t("검토 링크는 아직 보내지 않았어요.")}
              <small>
                {t("{email}에게 제목과 링크만 메일로 보내요.", {
                  email: professorEmail,
                })}
              </small>
            </p>
          )}
          {disabledReason.node}
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !!reason || available === null}
          aria-describedby={disabledReason.describedBy}
          onClick={() => setDraftOpen(true)}
        >
          {busy
            ? t("요청하는 중")
            : record
              ? t("메일로 다시 알리기")
              : t("교수님께 메일로도 알리기")}
        </Button>
      </div>
      <Dialog
        open={draftOpen}
        onOpenChange={(open) => {
          if (!busy) setDraftOpen(open);
        }}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>{t("이메일 초안 미리보기")}</DialogTitle>
            <DialogDescription>
              {t(
                "교수님께 보내기 전에 받는 사람과 포함되는 내용을 확인하세요. 개인 메모와 AI 대화는 포함되지 않아요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="review-email-draft">
            <div className="review-email-draft-row">
              <span>{t("받는 사람")}</span>
              <strong>{professorEmail}</strong>
            </div>
            <div className="review-email-draft-row">
              <span>{t("메일 제목")}</span>
              <strong>{t("[마진] {title}", { title: displayTitle })}</strong>
            </div>
            <div className="review-email-draft-body">
              <p>
                {t(
                  "‘{title}’ 검토 요청이 공유되었어요. 아래 링크에서 수정 내용과 첨부 파일을 확인할 수 있어요.",
                  { title: displayTitle },
                )}
              </p>
              <small>{reviewUrl}</small>
            </div>
          </div>
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDraftOpen(false)}
            >
              {t("취소")}
            </Button>
            <Button
              type="button"
              disabled={busy || !!reason}
              onClick={() => void send()}
            >
              {busy ? t("요청하는 중") : t("메일 발송 요청하기")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
