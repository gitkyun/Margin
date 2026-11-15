import { t } from "@/lib/i18n";
import { useEffect, useId, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { privateBlob } from "@/lib/experience";
import type { AudioSource, Recording } from "@/lib/domain";
import { clockText } from "@/lib/recording-timeline";
import { Icon } from "../icons";
import { Button } from "../ui/button";
import "./recording.css";

/**
 * 인식 결과는 말이 시작되고 조금 뒤에 나타나서, 구간 앞을 이만큼 더 들려줘요(ms).
 * 구간 끝도 같은 이유로 조금 늘려요.
 */
export const CLIP_LEAD_MS = 1500;
export const CLIP_TAIL_MS = 500;
const MIN_TRIM_MS = 1000;

export interface SourceAudioClipProps {
  /** 피드백에 저장된 녹음 위치(Feedback.audioSource) */
  source: AudioSource;
  /** 버튼 이름에 붙일 설명(예: 피드백 제목). 없으면 ‘녹음 구간’ */
  label?: string;
}

/** 출처의 녹음을 찾아요. recordingId가 없으면 그 미팅의 첫 녹음이에요. */
export function findSourceRecording(
  recordings: readonly Recording[],
  source: AudioSource,
): Recording | undefined {
  const live = recordings.filter((r) => !r.archivedAt);
  return source.recordingId
    ? live.find((r) => r.id === source.recordingId)
    : live.find((r) => r.meetingId === source.meetingId);
}

/**
 * 피드백이 나온 녹음 구간만 재생해요(Kokonut Clip Trimmer 기준 양끝 손잡이 + 반복 재생).
 * 녹음을 저장하지 않았거나 볼 수 없는 미팅이면 버튼을 끄고 이유를 한 줄 보여요.
 */
export function SourceAudioClip({ source, label }: SourceAudioClipProps) {
  const { data, mode } = useWorkspace();
  const recording = findSourceRecording(data.recordings, source);
  const audio = useRef<HTMLAudioElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const url = useRef("");
  const from = Math.max(0, source.startMs - CLIP_LEAD_MS);
  const to = Math.max(
    from + MIN_TRIM_MS,
    Math.min(
      source.endMs + CLIP_TAIL_MS,
      recording ? recording.duration * 1000 + CLIP_TAIL_MS : Infinity,
    ),
  );
  const length = to - from;
  const [loading, setLoading] = useState(false),
    [playing, setPlaying] = useState(false),
    [loop, setLoop] = useState(false),
    [trimStart, setTrimStart] = useState(0),
    [trimEnd, setTrimEnd] = useState(length),
    [position, setPosition] = useState(0),
    [draggingHandle, setDraggingHandle] = useState<
      "playhead" | "start" | "end" | null
    >(null),
    [error, setError] = useState("");
  const reasonId = useId();

  useEffect(() => {
    setTrimStart(0);
    setTrimEnd(length);
    setPosition(0);
  }, [length]);

  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  async function ensureLoaded(): Promise<HTMLAudioElement | null> {
    const el = audio.current;
    if (!el || !recording) return null;
    if (url.current) return el;
    setLoading(true);
    setError("");
    try {
      const blob = await privateBlob(recording, mode);
      const next = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        el.onloadedmetadata = () => resolve();
        el.onerror = () =>
          reject(
            new Error(t("녹음 파일을 열지 못했어요. 다시 시도해 주세요.")),
          );
        el.src = next;
        el.load();
      });
      el.onloadedmetadata = null;
      el.onerror = null;
      url.current = next;
      return el;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function play(at = Math.max(trimStart, Math.min(position, trimEnd))) {
    const el = await ensureLoaded();
    if (!el) return;
    el.currentTime = (from + at) / 1000;
    try {
      await el.play();
      setPlaying(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function pause() {
    audio.current?.pause();
    setPlaying(false);
  }

  const clamped = Math.max(trimStart, Math.min(position, trimEnd));
  const progress = length > 0 ? Math.max(0, Math.min(1, clamped / length)) : 0;
  const startPct = length > 0 ? (trimStart / length) * 100 : 0;
  const endPct = length > 0 ? (trimEnd / length) * 100 : 100;

  function msFromClientX(clientX: number): number {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * length);
  }

  function seekToMs(ms: number) {
    if (!recording || length <= 0) return;
    const next = Math.max(trimStart, Math.min(trimEnd, ms));
    setPosition(next);
    if (audio.current && url.current) {
      audio.current.currentTime = (from + next) / 1000;
    }
  }

  function updateHandle(handle: "playhead" | "start" | "end", ms: number) {
    if (handle === "start") {
      const next = Math.max(0, Math.min(ms, trimEnd - MIN_TRIM_MS));
      setTrimStart(next);
      if (position < next) seekToMs(next);
    } else if (handle === "end") {
      const next = Math.min(length, Math.max(ms, trimStart + MIN_TRIM_MS));
      setTrimEnd(next);
      if (position > next) seekToMs(next);
    } else {
      seekToMs(ms);
    }
  }

  const name = label ?? t("녹음 구간");
  const reason = !recording
    ? t("이 미팅에 저장한 녹음이 없거나 볼 수 없어서 재생할 수 없어요.")
    : "";
  const isTrimmed = trimStart > 0 || trimEnd < length;

  return (
    <div className="source-audio-clip">
      <Button
        variant="outline"
        size="icon-sm"
        disabled={!recording || loading}
        aria-describedby={reason ? reasonId : undefined}
        aria-label={
          playing ? t("{name} 정지", { name }) : t("{name} 재생", { name })
        }
        onClick={() => (playing ? pause() : void play())}
      >
        <Icon name={playing ? "pause" : "play"} size={16} />
      </Button>
      <div
        ref={track}
        role="slider"
        tabIndex={recording ? 0 : -1}
        aria-disabled={!recording || undefined}
        aria-label={t("{name} 재생 위치", { name })}
        aria-valuemin={trimStart}
        aria-valuemax={trimEnd}
        aria-valuenow={clamped}
        aria-valuetext={clockText(from + clamped)}
        className={`clip-trimmer-track${!recording ? " is-disabled" : ""}`}
        onPointerDown={(e) => {
          if (!recording) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDraggingHandle("playhead");
          seekToMs(msFromClientX(e.clientX));
        }}
        onPointerMove={(e) => {
          if (!recording || !draggingHandle) return;
          updateHandle(draggingHandle, msFromClientX(e.clientX));
        }}
        onPointerUp={() => setDraggingHandle(null)}
        onPointerCancel={() => setDraggingHandle(null)}
        onKeyDown={(e) => {
          if (!recording) return;
          const step = e.shiftKey ? 5000 : 1000;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            seekToMs(clamped + step);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            seekToMs(clamped - step);
          } else if (e.key === "Home") {
            e.preventDefault();
            seekToMs(trimStart);
          } else if (e.key === "End") {
            e.preventDefault();
            seekToMs(trimEnd);
          }
        }}
      >
        <div
          className="clip-trimmer-range"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          aria-hidden="true"
        />
        <div
          className="clip-trimmer-playhead"
          style={{ left: `${progress * 100}%` }}
          aria-hidden="true"
        />
        <button
          type="button"
          className="clip-trimmer-handle is-start"
          style={{ left: `${startPct}%` }}
          disabled={!recording}
          aria-label={t("시작 위치")}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!recording) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDraggingHandle("start");
          }}
        />
        <button
          type="button"
          className="clip-trimmer-handle is-end"
          style={{ left: `${endPct}%` }}
          disabled={!recording}
          aria-label={t("끝 위치")}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (!recording) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDraggingHandle("end");
          }}
        />
      </div>
      <span className="source-audio-time">
        {clockText(from + clamped)} / {clockText(from + trimEnd)}
      </span>
      <Button
        type="button"
        variant={loop ? "secondary" : "ghost"}
        size="sm"
        disabled={!recording}
        aria-pressed={loop}
        onClick={() => setLoop((v) => !v)}
      >
        <Icon name="refresh" size={14} />
        {t("반복 재생")}
      </Button>
      {isTrimmed && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setTrimStart(0);
            setTrimEnd(length);
            seekToMs(0);
          }}
        >
          {t("구간 초기화")}
        </Button>
      )}
      <audio
        ref={audio}
        preload="none"
        onTimeUpdate={(e) => {
          const at = e.currentTarget.currentTime * 1000 - from;
          if (at >= trimEnd) {
            if (loop) {
              e.currentTarget.currentTime = (from + trimStart) / 1000;
              setPosition(trimStart);
              return;
            }
            e.currentTarget.pause();
            setPlaying(false);
            setPosition(trimStart);
            return;
          }
          setPosition(Math.max(trimStart, at));
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(trimStart);
        }}
      />
      {reason && (
        <p id={reasonId} className="source-audio-note">
          {reason}
        </p>
      )}
      {error && (
        <p className="source-audio-note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
