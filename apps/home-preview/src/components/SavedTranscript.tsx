import { useRef, useState } from "react";
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
    label: "저장하지 않은 전사문",
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
      toast.success("전사문을 저장했습니다.");
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
        전사문을 불러오지 못했습니다.{" "}
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
          음성 인식 초안입니다. 원음을 들으며 전문용어와 빠진 말을 확인하세요.
          녹음을 공유해도 이 전사문은 공개되지 않습니다.
        </p>
        {current.warnings.length > 0 && (
          <div className="transcript-notice">
            일부 구간의 인식이 끊겼거나 확정되지 않았을 수 있습니다. 원음과
            비교해 주세요.
          </div>
        )}
        {draft === null ? (
          <div className="transcript-text">
            {value ||
              "인식한 문장이 없습니다. 원음을 들으며 직접 작성할 수 있습니다."}
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
            {error} 작성한 글은 이 화면에 남아 있습니다.
          </p>
        )}
        {conflict && (
          <div className="transcript-notice">
            <strong>다른 창에서 저장한 내용이 있습니다.</strong>
            <details>
              <summary>최신 저장본 비교</summary>
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
              내 작성본을 유지하고 최신본 기준으로 저장하기
            </Button>
            <p className="student-footnote">
              위 최신본과 비교한 뒤 누르세요. 이후 저장하면 내 작성본으로 새
              수정본을 남깁니다.
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
            <p>자동으로 인식한 문장이 없습니다.</p>
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
          수정본 v{current.revision} ·{" "}
          {new Date(current.updated_at).toLocaleString("ko-KR")}
        </small>
      </div>
      <Dialog open={append} onOpenChange={setAppend}>
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>전사문을 미팅 메모에 추가할까요?</DialogTitle>
            <DialogDescription>
              {memoShared
                ? "이 미팅의 메모는 공동연구자에게 공개됩니다. 비공개 전사문을 추가하면 해당 내용도 함께 공개됩니다."
                : "현재 작성 중인 메모 뒤에 저장한 전사문을 추가합니다. 기존 메모는 지우지 않으며, 미팅 메모의 저장 상태를 확인해 주세요."}
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
                    "미팅 메모에 추가했습니다. 메모 저장 상태를 확인하세요.",
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
