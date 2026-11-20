import { t } from "@/lib/i18n";
import { useEffect, useId, useRef, useState } from "react";
import { formatDateTime, type AudioSource } from "@/lib/domain";
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
import { isUncertain, timeRangeForSelection } from "@/lib/recording-timeline";
import {
  addMark,
  kindAt,
  markedPieces,
  overlapsMark,
  removeMarks,
  validMarks,
} from "@/lib/recording-marks";
import { isMarkKey } from "@/lib/mark-key";
import { markKindLabel } from "@/lib/mark-kinds";
import { markKindOptions } from "./recording/mark-kind-options";
import {
  pickRange,
  sentenceAt,
  sentenceRanges,
  stepSentence,
  type SentencePick,
} from "@/lib/sentence-keys";
import {
  SelectionToolbar,
  selectOffsets,
  useDomSelection,
  type SelectionAction,
} from "./recording/SelectionPopover";
import {
  SyncedTranscript,
  type SyncedTranscriptSegment,
} from "./recording/SyncedTranscript";
import { Button } from "./ui/button";
import { DisabledReason, StatusBadge } from "./common";
import { Disclosure } from "./ui/disclosure";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

/** 전사문에서 고른 글로 만들 항목과 그 글의 녹음 위치 */
export interface TranscriptPick {
  kind: "feedback" | "decision" | "question";
  text: string;
  /** 녹음 위치를 찾지 못하면 없어요(직접 고친 문장 등). */
  source?: AudioSource;
}

export function SavedTranscript({
  recording,
  memoShared,
  onAppend,
  onPick,
}: {
  recording: Recording;
  memoShared: boolean;
  onAppend?: (text: string) => void;
  onPick?: (pick: TranscriptPick) => void;
}) {
  const { mode, user, save } = useWorkspace(),
    cache = useQueryClient();
  const textBox = useRef<HTMLDivElement>(null),
    textHost = useRef<HTMLDivElement>(null),
    [marking, setMarking] = useState(false);
  const query = useQuery({
    queryKey: ["live-transcript", mode, user.id, recording.id],
    queryFn: () => getLiveTranscript(recording.id, user.id, mode),
    retry: 1,
  });
  const [draft, setDraft] = useState<string | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [append, setAppend] = useState(false),
    [transcriptOpen, setTranscriptOpen] = useState(false);
  useEffect(() => {
    if (draft !== null) {
      setTranscriptOpen(true);
    }
  }, [draft]);
  const base = useRef<LiveTranscript | null>(null),
    saveReasonId = useId(),
    appendReasonId = useId();
  const current = query.data,
    dirty = draft !== null && draft !== base.current?.edited_text;
  // 재생 위치와 전사문 연결: 녹음에 문장별 시간이 있을 때만 쓰고, 없으면 시간을 만들지 않아요.
  const [playMs, setPlayMs] = useState(0);
  const audioId = `audio-${recording.id}`;
  useEffect(() => {
    const audio = document.getElementById(audioId);
    if (!(audio instanceof HTMLAudioElement)) return;
    const sync = () => setPlayMs(audio.currentTime * 1000);
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("seeked", sync);
    return () => {
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("seeked", sync);
    };
  }, [audioId]);
  const timedSegments: SyncedTranscriptSegment[] | null =
    current &&
    recording.segmentTimes &&
    recording.segmentTimes.length === current.raw_segments.length
      ? current.raw_segments.flatMap((part, i) => {
          const time = recording.segmentTimes?.[i];
          if (!time || !part.text.trim()) return [];
          return [
            {
              startMs: time.startMs,
              endMs: time.endMs,
              text: part.text.trim(),
              pending: !part.final,
              unsure: isUncertain(time.confidence),
            },
          ];
        })
      : null;
  function seekAudio(startMs: number) {
    const audio = document.getElementById(audioId);
    if (!(audio instanceof HTMLAudioElement) || !audio.src) {
      toast.info(t("위의 ‘재생’을 먼저 눌러 주세요."));
      return;
    }
    audio.currentTime = startMs / 1000;
  }
  const selection = useDomSelection(
    textBox,
    textHost,
    draft === null && !!current?.edited_text,
  );
  // 키보드로 읽기(04 §5.1): ↑/↓로 고른 문장 번호와, 화면 낭독기에 알릴 고른 글
  const keyPick = useRef<SentencePick | null>(null),
    [spoken, setSpoken] = useState(""),
    readingHintId = useId();
  // 고른 글이 있을 때 `H`로 형광펜(04 §11). 칠할 수 있을 때만 아래 렌더에서 채웁니다.
  const markShortcut = useRef<(() => void) | null>(null);
  markShortcut.current = null;
  useEffect(() => {
    let previous: { code: string; at: number } | null = null;
    const onKey = (event: KeyboardEvent) => {
      const before =
        previous && event.timeStamp - previous.at < 1000
          ? previous.code
          : undefined;
      previous = { code: event.code, at: event.timeStamp };
      const run = markShortcut.current;
      if (!run || !isMarkKey(event, before)) return;
      event.preventDefault();
      run();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useNavigationGuard({
    dirty,
    busy: saving,
    label: t("수정 중인 전사문"),
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
      toast.success(t("전사문을 저장했어요"));
    } catch (e) {
      setError((e as Error).message);
      if ((e as Error & { code?: string }).code === "PT409")
        void query.refetch();
    } finally {
      setSaving(false);
    }
  }
  async function changeMarks(next: Recording["transcriptMarks"]) {
    setMarking(true);
    try {
      await save("recordings", { ...recording, transcriptMarks: next });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMarking(false);
    }
  }
  if (query.isPending)
    return (
      <p className="student-footnote" role="status">
        {t("전사문 불러오는 중")}
      </p>
    );
  if (query.isError)
    return (
      <div className="transcript-notice" role="alert">
        {t("전사문을 불러오지 못했어요.")}{" "}
        <Button
          size="sm"
          variant="outline"
          onClick={() => void query.refetch()}
        >
          {t("다시 불러오기")}
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
  // 충돌은 위 안내가 이미 알려 주므로 바뀐 것이 없을 때만 이유를 보여요.
  const saveReason =
    draft !== null &&
    !saving &&
    !conflict &&
    !dirty &&
    t("바뀐 내용이 없어요.");
  const marks = validMarks(recording.transcriptMarks, current.edited_text);
  const lostMarks = (recording.transcriptMarks?.length ?? 0) > marks.length;
  const picked = selection.picked;
  const pickActions: SelectionAction[] = [];
  if (picked && draft === null) {
    const text = current.edited_text;
    const marked = overlapsMark(marks, text, picked.start, picked.end);
    if (!marking) {
      const toggleMark = () =>
        void changeMarks(
          marked
            ? removeMarks(marks, text, picked.start, picked.end)
            : addMark(marks, text, picked.start, picked.end),
        );
      markShortcut.current = () => {
        toggleMark();
        selection.clear();
      };
      pickActions.push({
        key: "mark",
        icon: "edit",
        label: marked ? t("형광펜 지우기") : t("형광펜"),
        shortcut: "H",
        onSelect: toggleMark,
        // ▾: 종류를 골라 칠하거나, 칠한 곳의 종류를 바꿔요(6단계).
        ...markKindOptions(
          kindAt(marks, text, picked.start, picked.end),
          (kind) =>
            void changeMarks(
              addMark(marks, text, picked.start, picked.end, kind),
            ),
        ),
      });
    }
    if (onPick) {
      const range = timeRangeForSelection(
        current.raw_segments,
        recording.segmentTimes,
        text,
        picked.start,
        picked.end,
      );
      const source = range
        ? {
            meetingId: recording.meetingId,
            recordingId: recording.id,
            ...range,
          }
        : undefined;
      const pick = (kind: TranscriptPick["kind"]) => () => {
        window.getSelection()?.removeAllRanges();
        onPick({ kind, text: picked.text, source });
      };
      pickActions.push(
        {
          key: "feedback",
          icon: "plus",
          label: t("피드백"),
          onSelect: pick("feedback"),
        },
        {
          key: "decision",
          icon: "plus",
          label: t("결정"),
          onSelect: pick("decision"),
        },
        {
          key: "question",
          icon: "plus",
          label: t("질문"),
          onSelect: pick("question"),
        },
      );
    }
  }
  /** ↑/↓ 문장 이동, Shift+↑/↓ 범위, Enter 선택 메뉴, Esc 고르기 취소(04 §5.1·§11) */
  function onReadingKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.nativeEvent.isComposing ||
      !current
    )
      return;
    const box = event.currentTarget;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const text = current.edited_text;
      const ranges = sentenceRanges(text);
      if (!ranges.length) return;
      event.preventDefault();
      let pick = keyPick.current;
      if (!pick && picked) {
        const index = sentenceAt(ranges, picked.start);
        pick = { anchor: index, focus: index };
      }
      const next = stepSentence(
        pick,
        ranges.length,
        event.key === "ArrowDown" ? 1 : -1,
        event.shiftKey,
      );
      if (!next) return;
      keyPick.current = next;
      const { start, end } = pickRange(ranges, next);
      const range = selectOffsets(box, start, end);
      if (range) keepInView(box, range);
      selection.refresh(false);
      setSpoken(text.slice(start, end));
    } else if (event.key === "Enter" && picked) {
      event.preventDefault();
      selection.refresh(true);
      // 막대가 뜨면 첫 버튼으로 들어가 Tab·Enter로 고릅니다. Esc는 이 글로 돌아와요.
      requestAnimationFrame(() =>
        textHost.current
          ?.querySelector<HTMLElement>(".selection-toolbar button")
          ?.focus(),
      );
    } else if (event.key === "Escape" && (picked || keyPick.current)) {
      keyPick.current = null;
      window.getSelection()?.removeAllRanges();
      selection.clear();
      setSpoken("");
    }
  }
  /** 막대를 닫을 때 초점이 막대 안에 있었으면 전사문으로 돌려놓아요. */
  function dismissToolbar() {
    const inside = (document.activeElement as HTMLElement | null)?.closest(
      ".selection-toolbar",
    );
    selection.clear();
    if (inside) textBox.current?.focus();
  }
  const appendReason =
    !!onAppend &&
    !saving &&
    (dirty
      ? t("수정한 전사문을 저장하면 메모에 추가할 수 있어요.")
      : !current.edited_text.trim() &&
        t("전사문이 비어 있어 메모에 추가할 수 없어요."));
  return (
    <Disclosure
      className="saved-transcript"
      open={transcriptOpen}
      onOpenChange={setTranscriptOpen}
      summary={
        <>
          {t("한국어 전사문")}{" "}
          <StatusBadge tone="neutral">{t("나만 보기")}</StatusBadge>
          <span>
            {t("{count}자", {
              count: current.edited_text.length.toLocaleString(),
            })}
          </span>
        </>
      }
    >
      <div className="transcript-content">
        <p className="student-footnote">
          {t(
            "자동으로 인식한 문장은 틀릴 수 있어요. 녹음을 들으며 전문용어와 빠진 말을 확인해 주세요. 음성을 공유해도 이 전사문은 나만 볼 수 있어요.",
          )}
        </p>
        {current.warnings.length > 0 && (
          <div className="transcript-notice">
            {t(
              "일부 구간은 인식이 끊겼거나 확정되지 않았을 수 있어요. 녹음과 비교해 주세요.",
            )}
          </div>
        )}
        {draft === null ? (
          <div className="selection-host" ref={textHost}>
            <div
              className="transcript-text"
              ref={textBox}
              tabIndex={value ? 0 : undefined}
              role={value ? "document" : undefined}
              aria-label={value ? t("한국어 전사문") : undefined}
              aria-describedby={value ? readingHintId : undefined}
              onKeyDown={value ? onReadingKey : undefined}
              onMouseDown={() => {
                keyPick.current = null;
              }}
            >
              {value
                ? markedPieces(value, marks).map((piece) =>
                    piece.marked ? (
                      <mark
                        key={piece.start}
                        className="transcript-mark"
                        data-kind={piece.kind}
                        data-label={t("형광펜 {kind}", {
                          kind: markKindLabel(piece.kind),
                        })}
                        title={markKindLabel(piece.kind)}
                      >
                        {piece.text}
                      </mark>
                    ) : (
                      piece.text
                    ),
                  )
                : t("인식한 문장이 없어요. 녹음을 들으며 직접 쓸 수 있어요.")}
            </div>
            <span className="sr-only" aria-live="polite">
              {spoken}
            </span>
            <SelectionToolbar
              anchor={selection.anchor}
              actions={pickActions}
              onDismiss={dismissToolbar}
              label={t("고른 전사문으로 만들기")}
            />
          </div>
        ) : (
          <label className="transcript-field">
            {t("전사문 수정")}
            <textarea
              value={value}
              maxLength={100000}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving}
              rows={9}
            />
          </label>
        )}
        {draft === null && !!value && (
          <p className="transcript-mark-hint" id={readingHintId}>
            {onPick
              ? t(
                  "문장을 드래그해 고르면 형광펜을 칠하거나 피드백·결정·질문으로 만들 수 있어요. 형광펜은 전사문 글자를 바꾸지 않아요.",
                )
              : t(
                  "문장을 드래그해 고르면 형광펜을 칠할 수 있어요. 형광펜은 전사문 글자를 바꾸지 않아요.",
                )}
            {` ${t("키보드로는 위아래 화살표로 문장을 고르고, Shift를 함께 눌러 넓힌 뒤 Enter로 메뉴를 열어요. H를 누르면 형광펜을 칠해요.")}`}
            {lostMarks &&
              ` ${t("전사문을 고쳐서 일부 형광펜 표시가 사라졌어요.")}`}
          </p>
        )}
        {error && (
          <p role="alert" className="rms-error">
            {error} {t("작성한 글은 이 화면에 그대로 있어요.")}
          </p>
        )}
        {conflict && (
          <div className="transcript-notice">
            <strong>{t("다른 창에서 저장한 전사문이 있어요.")}</strong>
            <Disclosure summary={t("최신 저장본과 비교하기")}>
              <p className="transcript-text">{current.edited_text}</p>
            </Disclosure>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                base.current = current;
                setError("");
              }}
            >
              {t("내 작성 내용 유지")}
            </Button>
            <p className="student-footnote">
              {t(
                "최신 저장본과 비교한 뒤 눌러 주세요. 그다음 ‘전사문 저장’을 누르면 최신 저장본이 내 작성 내용으로 바뀌어요.",
              )}
            </p>
          </div>
        )}
        <Disclosure
          className="transcript-original"
          summary={t("처음 인식한 내용 보기")}
        >
          {timedSegments?.length ? (
            <SyncedTranscript
              segments={timedSegments}
              currentMs={playMs}
              onSeek={seekAudio}
            />
          ) : current.raw_segments.length ? (
            current.raw_segments.map((part, i) => {
              const unsure = isUncertain(
                recording.segmentTimes?.[i]?.confidence,
              );
              return (
                <p key={i}>
                  {!part.final && (
                    <StatusBadge tone="amber">{t("미확정")}</StatusBadge>
                  )}{" "}
                  <span
                    className={unsure ? "speech-uncertain" : undefined}
                    title={unsure ? t("인식이 불확실해요") : undefined}
                  >
                    {part.text}
                  </span>
                  {unsure && (
                    <span className="sr-only"> ({t("인식이 불확실해요")})</span>
                  )}
                </p>
              );
            })
          ) : (
            <p>{t("자동으로 인식한 문장이 없어요.")}</p>
          )}
        </Disclosure>
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
              {t("전사문 수정")}
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
                {t("수정 취소")}
              </Button>
              <Button
                size="sm"
                disabled={saving || conflict || !dirty}
                aria-describedby={saveReason ? saveReasonId : undefined}
                onClick={() => void store()}
              >
                {saving ? t("저장 중") : t("전사문 저장")}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => downloadTranscript(value, recording.title)}
          >
            {t("TXT 내려받기")}
          </Button>
          {onAppend && (
            <Button
              size="sm"
              variant="outline"
              disabled={dirty || !current.edited_text.trim() || saving}
              aria-describedby={appendReason ? appendReasonId : undefined}
              onClick={() => setAppend(true)}
            >
              {t("미팅 메모에 추가")}
            </Button>
          )}
        </div>
        <DisabledReason id={saveReasonId} reason={saveReason} />
        <DisabledReason id={appendReasonId} reason={appendReason} />
        <small className="student-footnote">
          {t("수정본 v{revision} · {date}", {
            revision: current.revision,
            date: formatDateTime(current.updated_at),
          })}
        </small>
      </div>
      <Dialog open={append} onOpenChange={setAppend}>
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>{t("전사문을 미팅 메모에 추가할까요?")}</DialogTitle>
            <DialogDescription>
              {memoShared
                ? t(
                    "이 미팅 메모는 공동연구자에게 공개돼 있어요. 전사문을 추가하면 나만 보던 내용도 공동연구자가 볼 수 있어요.",
                  )
                : t(
                    "저장한 전사문을 지금 메모 끝에 붙여요. 기존 메모는 지워지지 않아요.",
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppend(false)}>
              {t("취소")}
            </Button>
            <Button
              onClick={() => {
                try {
                  onAppend?.(
                    `\n\n${t("‘{title}’ 녹음 전사문", { title: recording.title })}\n${current.edited_text}`,
                  );
                  setAppend(false);
                  toast.success(
                    t(
                      "미팅 메모에 추가했어요. 메모가 저장됐는지 확인해 주세요.",
                    ),
                  );
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              {memoShared ? t("공동 메모에 추가") : t("메모에 추가")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Disclosure>
  );
}

/** 키보드로 고른 문장이 전사문 상자(스크롤 영역) 밖이면 보이는 곳으로 옮겨요. */
function keepInView(box: HTMLElement, range: Range) {
  const rect = range.getBoundingClientRect(),
    frame = box.getBoundingClientRect(),
    gap = 8;
  if (rect.top < frame.top) box.scrollTop -= frame.top - rect.top + gap;
  else if (rect.bottom > frame.bottom)
    box.scrollTop += rect.bottom - frame.bottom + gap;
}
