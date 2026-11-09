import { useRef, useState } from "react";
import { formatDateTime } from "@/lib/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import { useNavigationGuard } from "@/lib/navigation-guard";
import {
  getLiveTranscript,
  saveLiveTranscript,
  downloadTranscript,
  type LiveTranscript,
} from "@/lib/live-transcript";
import type { Recording } from "@/lib/domain";
import { Button } from "./ui/button";
import { StatusBadge } from "./common";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function SavedTranscript({
  recording,
  memoShared,
  onAppend,
}: {
  recording: Recording;
  memoShared: boolean;
  onAppend?: (text: string) => void;
}) {
  const { mode, user } = useWorkspace(),
    cache = useQueryClient();
  const query = useQuery({
    queryKey: ["live-transcript", mode, user.id, recording.id],
    queryFn: () => getLiveTranscript(recording.id, user.id, mode),
    retry: 1,
  });
  const [draft, setDraft] = useState<string | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [append, setAppend] = useState(false);
  const base = useRef<LiveTranscript | null>(null);
  const current = query.data,
    dirty = draft !== null && draft !== base.current?.edited_text;
  useNavigationGuard({
    dirty,
    busy: saving,
    label: "수정 중인 전사문",
    onDiscard: () => {
      setDraft(null);
      base.current = null;
    },
  });
  async function store() {
    if (!base.current || draft === null) return;
    setSaving(true);
    setError("");
    try {
      const saved = await saveLiveTranscript(
        { ...base.current, edited_text: draft },
        recording.researchId,
        user.id,
        mode,
      );
      cache.setQueryData(
        ["live-transcript", mode, user.id, recording.id],
        saved,
      );
      setDraft(null);
      base.current = null;
      toast.success("전사문을 저장했어요");
    } catch (e) {
      setError((e as Error).message);
      if ((e as Error & { code?: string }).code === "PT409")
        void query.refetch();
    } finally {
      setSaving(false);
    }
  }
  if (query.isPending)
    return (
      <p className="student-footnote" role="status">
        전사문 불러오는 중
      </p>
    );
  if (query.isError)
    return (
      <div className="transcript-notice" role="alert">
        전사문을 불러오지 못했어요.{" "}
        <Button
          size="sm"
          variant="outline"
          onClick={() => void query.refetch()}
        >
          다시 불러오기
        </Button>
      </div>
    );
  if (!current) return null;
  const value = draft ?? current.edited_text;
  const conflict = Boolean(
    draft !== null &&
    base.current &&
    base.current.revision !== current.revision,
  );
  return (
    <details className="saved-transcript" open={draft !== null || undefined}>
      <summary>
        한국어 전사문 <StatusBadge tone="neutral">나만 보기</StatusBadge>
        <span>{current.edited_text.length.toLocaleString()}자</span>
      </summary>
      <div className="transcript-content">
        <p className="student-footnote">
          자동으로 인식한 문장은 틀릴 수 있어요. 녹음을 들으며 전문용어와 빠진
          말을 확인해 주세요. 음성을 공유해도 이 전사문은 나만 볼 수 있어요.
        </p>
        {current.warnings.length > 0 && (
          <div className="transcript-notice">
            일부 구간은 인식이 끊겼거나 확정되지 않았을 수 있어요. 녹음과 비교해
            주세요.
          </div>
        )}
        {draft === null ? (
          <div className="transcript-text">
            {value || "인식한 문장이 없어요. 녹음을 들으며 직접 쓸 수 있어요."}
          </div>
        ) : (
          <label className="transcript-field">
            전사문 수정
            <textarea
              value={value}
              maxLength={100000}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              rows={9}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="rms-error">
            {error} 작성한 글은 이 화면에 그대로 있어요.
          </p>
        )}
        {conflict && (
          <div className="transcript-notice">
            <strong>다른 창에서 저장한 전사문이 있어요.</strong>
            <details>
              <summary>최신 저장본과 비교하기</summary>
              <p className="transcript-text">{current.edited_text}</p>
            </details>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                base.current = current;
                setError("");
              }}
            >
              내 작성 내용 유지
            </Button>
            <p className="student-footnote">
              최신 저장본과 비교한 뒤 눌러 주세요. 그다음 ‘전사문 저장’을 누르면
              최신 저장본이 내 작성 내용으로 바뀌어요.
            </p>
          </div>
        )}
        <details className="transcript-original">
          <summary>처음 인식한 내용 보기</summary>
          {current.raw_segments.length ? (
            current.raw_segments.map((part, i) => (
              <p key={i}>
                {!part.final && <StatusBadge tone="amber">미확정</StatusBadge>}{" "}
                {part.text}
              </p>
            ))
          ) : (
            <p>자동으로 인식한 문장이 없어요.</p>
          )}
        </details>
        <div className="button-row">
          {draft === null ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                base.current = current;
                setDraft(current.edited_text);
              }}
            >
              전사문 수정
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  base.current = null;
                  setDraft(null);
                  setError("");
                }}
              >
                수정 취소
              </Button>
              <Button
                size="sm"
                disabled={saving || conflict || !dirty}
                onClick={() => void store()}
              >
                {saving ? "저장 중" : "전사문 저장"}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => downloadTranscript(value, recording.title)}
          >
            TXT 내려받기
          </Button>
          {onAppend && (
            <Button
              size="sm"
              variant="outline"
              disabled={dirty || !current.edited_text.trim() || saving}
              onClick={() => setAppend(true)}
            >
              미팅 메모에 추가
            </Button>
          )}
        </div>
        <small className="student-footnote">
          수정본 v{current.revision} · {formatDateTime(current.updated_at)}
        </small>
      </div>
      <Dialog open={append} onOpenChange={setAppend}>
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>전사문을 미팅 메모에 추가할까요?</DialogTitle>
            <DialogDescription>
              {memoShared
                ? "이 미팅 메모는 공동연구자에게 공개돼 있어요. 전사문을 추가하면 나만 보던 내용도 공동연구자가 볼 수 있어요."
                : "저장한 전사문을 지금 메모 끝에 붙여요. 기존 메모는 지워지지 않아요."}
            </DialogDescription>
          </DialogHeader>
          <div className="bottom-actions">
            <Button variant="outline" onClick={() => setAppend(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                try {
                  onAppend?.(
                    `\n\n[음성 인식 전사 · ${recording.title}]\n${current.edited_text}`,
                  );
                  setAppend(false);
                  toast.success(
                    "미팅 메모에 추가했어요. 메모가 저장됐는지 확인해 주세요.",
                  );
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              {memoShared ? "공동 메모에 추가" : "메모에 추가"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </details>
  );
}
