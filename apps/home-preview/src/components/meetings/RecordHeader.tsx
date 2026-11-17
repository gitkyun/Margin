import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ConfirmDialog";
import { StatusBadge } from "@/components/common";
import { VisibilityField } from "@/components/experience";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import { formatDate, meetingLabels, type Meeting } from "@/lib/domain";
import { formatClock } from "@/lib/time-format";
import { seoulToday } from "@/lib/home-meeting";
import type { RecordMode } from "@/lib/record-view";
import "./record-header.css";

const SOURCE_LABELS: Record<string, string> = {
  kakao: t("카톡"),
  email: t("메일"),
  doc_comment: t("문서 댓글"),
  note: t("메모"),
  file: t("파일"),
  other: t("기타"),
};

/** 이 기록이 보여 주는 쪽: 준비 내용 또는 기록 */
export type RecordView = "prepare" | "record";

/**
 * 기록 머리(IA v2 04 §3). 제목은 그 자리에서 고치고, 모드에 따라 버튼이 바뀝니다.
 * 파란 채움 버튼은 준비 모드의 [녹음 시작]과 기록 남기는 중의 [기록 완료로 바꾸기] 하나뿐입니다.
 */
export function RecordHeader({
  meeting,
  mode,
  view,
  onView,
  onEditInfo,
  onStartRecording,
}: {
  meeting: Meeting;
  mode: RecordMode;
  view: RecordView;
  onView(view: RecordView): void;
  onEditInfo(): void;
  onStartRecording(): void;
}) {
  const { data, save, saveResearch, remove } = useWorkspace();
  const [confirmDialog, confirm] = useConfirm();
  const research = data.researches.find(
    (item) => item.id === meeting.researchId,
  );
  const collaborative = data.members.some(
    (member) =>
      member.researchId === meeting.researchId &&
      member.status === "active" &&
      member.userId !== research?.ownerId,
  );
  const written = meeting.recordType === "written";

  async function update(patch: Partial<Meeting>, done?: string) {
    try {
      await save("meetings", { ...meeting, ...patch });
      if (done) toast.success(done);
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  async function archive() {
    try {
      await remove("meetings", meeting.id);
      toast.success(t("보관했어요."), {
        duration: 6000,
        action: {
          label: t("되돌리기"),
          onClick: () => void update({ archivedAt: undefined }),
        },
      });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  async function cancelMeeting() {
    const ok = await confirm({
      title: t("미팅을 취소할까요?"),
      description: t("기록과 준비한 내용은 그대로 남아요."),
      confirmLabel: t("미팅 취소"),
      destructive: true,
    });
    if (ok) await update({ status: "cancelled" }, t("미팅을 취소했어요."));
  }

  const when =
    written && meeting.date
      ? t("{date} 받음", { date: formatDate(meeting.date) })
      : meeting.date
        ? `${formatDate(meeting.date)}${meeting.time ? ` ${formatClock(meeting.time)}` : ""}`
        : t("날짜 미정");
  const badge = written
    ? t("서면 피드백 · {source}", {
        source: SOURCE_LABELS[meeting.sourceLabel ?? "other"] ?? "",
      })
    : meetingLabels[meeting.status];

  return (
    <>
      {confirmDialog}
      <header className="record-head">
        <Link
          className="record-head-back"
          to={`/r/${meeting.researchId}/meetings`}
        >
          <Icon name="arrow-left" size={16} />
          {t("미팅")}
        </Link>
        <div className="record-head-main">
          <TitleEditor
            value={meeting.title}
            onSave={(title) => void update({ title })}
          />
          <div className="record-head-meta">
            <StatusBadge
              tone={
                meeting.status === "recorded" || written
                  ? "green"
                  : meeting.status === "cancelled"
                    ? "neutral"
                    : "blue"
              }
            >
              {badge}
            </StatusBadge>
            <button
              type="button"
              className="record-head-when"
              aria-label={t("날짜·시각 바꾸기, 지금 {when}", { when })}
              onClick={onEditInfo}
            >
              {when}
            </button>
            {collaborative && (
              <VisibilityField
                compact
                value={meeting.visibility ?? "private"}
                onChange={(visibility) => void update({ visibility })}
              />
            )}
          </div>
        </div>
        <div className="record-head-actions">
          {mode === "prepare" && view === "prepare" && (
            <>
              <Button onClick={onStartRecording}>
                <Icon name="mic" size={16} />
                {t("녹음 시작")}
              </Button>
              <Button variant="outline" onClick={() => onView("record")}>
                {t("기록 남기기")}
              </Button>
            </>
          )}
          {mode === "drafting" && (
            <>
              <Button variant="outline" onClick={onStartRecording}>
                <Icon name="mic" size={16} />
                {t("녹음 시작")}
              </Button>
              <Button
                onClick={() =>
                  void update(
                    { status: "recorded" },
                    t("기록 완료로 바꿨어요."),
                  )
                }
              >
                {t("기록 완료로 바꾸기")}
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("기록 메뉴")}
              >
                <Icon name="more" size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEditInfo}>
                <Icon name="edit" size={16} />
                {t("기록 정보 편집")}
              </DropdownMenuItem>
              {!written &&
                research &&
                research.nextMeetingId !== meeting.id &&
                meeting.status === "preparing" && (
                  <DropdownMenuItem
                    onSelect={() =>
                      void saveResearch({
                        ...research,
                        nextMeetingId: meeting.id,
                      })
                        .then(() =>
                          toast.success(t("홈의 다음 미팅으로 지정했어요")),
                        )
                        .catch((error) => toast.error(friendlyError(error)))
                    }
                  >
                    <Icon name="flag" size={16} />
                    {t("홈의 다음 미팅으로 지정")}
                  </DropdownMenuItem>
                )}
              {!written && (
                <DropdownMenuItem
                  onSelect={() =>
                    onView(view === "prepare" ? "record" : "prepare")
                  }
                >
                  <Icon name="layers" size={16} />
                  {view === "prepare" ? t("기록 보기") : t("준비 내용 보기")}
                </DropdownMenuItem>
              )}
              {!written &&
                (meeting.status === "cancelled" ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      void update(
                        { status: "preparing" },
                        t("취소를 되돌렸어요."),
                      )
                    }
                  >
                    <Icon name="undo" size={16} />
                    {t("취소 되돌리기")}
                  </DropdownMenuItem>
                ) : (
                  meeting.status === "preparing" && (
                    <DropdownMenuItem onSelect={() => void cancelMeeting()}>
                      <Icon name="close" size={16} />
                      {t("미팅 취소")}
                    </DropdownMenuItem>
                  )
                ))}
              <DropdownMenuItem onSelect={() => void archive()}>
                <Icon name="trash" size={16} />
                {t("보관")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <RecordBanner
        meeting={meeting}
        mode={mode}
        view={view}
        onRecord={() => onView("record")}
        onUpdate={update}
      />
    </>
  );
}

/** 모드 띠(08 §4.3): 녹음이 끝나지 않은 기록, 취소한 미팅, 날짜가 지난 준비 중 미팅 */
function RecordBanner({
  meeting,
  mode,
  view,
  onRecord,
  onUpdate,
}: {
  meeting: Meeting;
  mode: RecordMode;
  view: RecordView;
  onRecord(): void;
  onUpdate(patch: Partial<Meeting>, done?: string): Promise<void>;
}) {
  if (mode === "unfinished")
    return (
      <div className="record-banner" role="status">
        <p>{t("녹음이 끝나지 않은 기록이에요.")}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void onUpdate({ status: "recorded" }, t("기록 완료로 바꿨어요."))
          }
        >
          {t("기록 완료로 바꾸기")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void onUpdate({ status: "preparing" })}
        >
          {t("준비 중으로 되돌리기")}
        </Button>
      </div>
    );
  if (mode === "cancelled")
    return (
      <div className="record-banner" role="status">
        <p>{t("취소한 미팅이에요.")}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void onUpdate({ status: "preparing" }, t("취소를 되돌렸어요."))
          }
        >
          {t("취소 되돌리기")}
        </Button>
      </div>
    );
  if (
    mode === "prepare" &&
    view === "prepare" &&
    meeting.status === "preparing" &&
    !!meeting.date &&
    meeting.date < seoulToday()
  )
    return (
      <div className="record-banner" role="status">
        <p>{t("미팅 날짜가 지났어요.")}</p>
        <Button size="sm" variant="outline" onClick={onRecord}>
          {t("기록 남기기")}
        </Button>
      </div>
    );
  return null;
}

/** 제목을 그 자리에서 고칩니다. Enter 저장, Esc 취소, 200자(서버 한도). */
function TitleEditor({
  value,
  onSave,
}: {
  value: string;
  onSave(value: string): void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  if (!editing)
    return (
      <h1 className="record-head-title">
        <button
          type="button"
          aria-label={t("{title}, 이름 고치기", { title: value })}
          onClick={() => setEditing(true)}
        >
          {value}
        </button>
      </h1>
    );
  const commit = () => {
    setEditing(false);
    const next = text.trim();
    if (next && next !== value) onSave(next);
    else setText(value);
  };
  return (
    <input
      autoFocus
      className="record-head-title-input"
      aria-label={t("기록 이름")}
      value={text}
      maxLength={200}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === "Enter") commit();
        if (event.key === "Escape") {
          event.stopPropagation();
          setText(value);
          setEditing(false);
        }
      }}
    />
  );
}
