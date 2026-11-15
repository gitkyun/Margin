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
const SCRUB_TICKS = 15;

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
 * 피드백이 나온 녹음 구간만 재생해요(재생/정지, 타임라인 눈금 오디오 스크러버).
 * 녹음을 저장하지 않았거나 볼 수 없는 미팅이면 버튼을 끄고 이유를 한 줄 보여요.
 * 음성 파일은 눌렀을 때 처음 한 번만 불러와요.
 */
export function SourceAudioClip({ source, label }: SourceAudioClipProps) {
  const { data, mode } = useWorkspace();
  const recording = findSourceRecording(data.recordings, source);
  const audio = useRef<HTMLAudioElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const url = useRef("");
  const [loading, setLoading] = useState(false),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [hoverRatio, setHoverRatio] = useState<number | null>(null),
    [dragging, setDragging] = useState(false),
    [error, setError] = useState("");
  const reasonId = useId();
  const from = Math.max(0, source.startMs - CLIP_LEAD_MS);
  const to = Math.max(
    from + 1000,
    Math.min(
      source.endMs + CLIP_TAIL_MS,
      recording ? recording.duration * 1000 + CLIP_TAIL_MS : Infinity,
    ),
  );
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
  async function play(at = position) {
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
  const length = to - from;
  const clamped = Math.min(position, length);
  const progress = length > 0 ? Math.max(0, Math.min(1, clamped / length)) : 0;
  function seekToRatio(ratio: number) {
    if (!recording || length <= 0) return;
    const next = Math.round(Math.max(0, Math.min(1, ratio)) * length);
    setPosition(next);
    if (audio.current && url.current)
      audio.current.currentTime = (from + next) / 1000;
  }
  function ratioFromClientX(clientX: number): number {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }
  const name = label ?? t("녹음 구간");
  const reason = !recording
    ? t("이 미팅에 저장한 녹음이 없거나 볼 수 없어서 재생할 수 없어요.")
    : "";
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
        aria-valuemin={0}
        aria-valuemax={length}
        aria-valuenow={clamped}
        aria-valuetext={clockText(from + clamped)}
        className={`timeline-scrubber${dragging ? " is-dragging" : ""}${!recording ? " is-disabled" : ""}`}
        onPointerDown={(e) => {
          if (!recording) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          const ratio = ratioFromClientX(e.clientX);
          setHoverRatio(ratio);
          seekToRatio(ratio);
        }}
        onPointerMove={(e) => {
          if (!recording) return;
          const ratio = ratioFromClientX(e.clientX);
          setHoverRatio(ratio);
          if (dragging) seekToRatio(ratio);
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onPointerLeave={() => {
          if (!dragging) setHoverRatio(null);
        }}
        onKeyDown={(e) => {
          if (!recording) return;
          const step = e.shiftKey ? 5000 : 1000;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            seekToRatio((clamped + step) / length);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            seekToRatio((clamped - step) / length);
          } else if (e.key === "Home") {
            e.preventDefault();
            seekToRatio(0);
          } else if (e.key === "End") {
            e.preventDefault();
            seekToRatio(1);
          }
        }}
      >
        <div className="timeline-scrubber-ticks" aria-hidden="true">
          {Array.from({ length: SCRUB_TICKS }, (_, index) => {
            const active = index / (SCRUB_TICKS - 1) <= progress;
            return (
              <span
                key={index}
                className={active ? "is-active" : undefined}
              />
            );
          })}
        </div>
        <div
          className="timeline-scrubber-fill"
          style={{ width: `${progress * 100}%` }}
          aria-hidden="true"
        />
        <span
          className="timeline-scrubber-thumb"
          style={{ left: `${progress * 100}%` }}
          aria-hidden="true"
        />
        {hoverRatio !== null && recording && (
          <span
            className="timeline-scrubber-preview"
            style={{ left: `${hoverRatio * 100}%` }}
            aria-hidden="true"
          >
            {clockText(from + Math.round(hoverRatio * length))}
          </span>
        )}
      </div>
      <span className="source-audio-time">
        {clockText(from + clamped)} / {clockText(to)}
      </span>
      <audio
        ref={audio}
        preload="none"
        onTimeUpdate={(e) => {
          const at = e.currentTarget.currentTime * 1000 - from;
          if (at >= length) {
            e.currentTarget.pause();
            setPlaying(false);
            setPosition(0);
            return;
          }
          setPosition(Math.max(0, at));
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
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
