import { t } from "@/lib/i18n";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { privateBlob } from "@/lib/experience";
import type { AudioSource, Recording } from "@/lib/domain";
import ClipTrimmer, { type ClipRange } from "@/components/kokonut/clip-trimmer";
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
  const url = useRef("");
  const from = Math.max(0, source.startMs - CLIP_LEAD_MS);
  const to = Math.max(
    from + MIN_TRIM_MS,
    Math.min(
      source.endMs + CLIP_TAIL_MS,
      recording && recording.duration > 0
        ? recording.duration * 1000
        : Infinity,
    ),
  );
  const length = to - from;
  const [loading, setLoading] = useState(false),
    [playing, setPlaying] = useState(false),
    [loop, setLoop] = useState(false),
    [trimStart, setTrimStart] = useState(0),
    [trimEnd, setTrimEnd] = useState(length),
    [position, setPosition] = useState(0),
    [error, setError] = useState("");
  const reasonId = useId();

  useEffect(() => {
    setTrimStart(0);
    setTrimEnd(length);
    setPosition(0);
    audio.current?.pause();
    setPlaying(false);
  }, [from, length, recording?.id]);

  useEffect(
    () => () => {
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = "";
    },
    [recording?.id, recording?.storagePath],
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
  function seekToMs(ms: number) {
    if (!recording || length <= 0) return;
    const next = Math.max(trimStart, Math.min(trimEnd, ms));
    setPosition(next);
    if (audio.current && url.current) {
      audio.current.currentTime = (from + next) / 1000;
    }
  }

  const onTrimRange = useCallback(
    (range: ClipRange) => {
      setTrimStart(range.start * 1000);
      setTrimEnd(range.end * 1000);
      setPosition((current) =>
        Math.max(range.start * 1000, Math.min(current, range.end * 1000)),
      );
      if (
        audio.current &&
        url.current &&
        (audio.current.currentTime * 1000 < from + range.start * 1000 ||
          audio.current.currentTime * 1000 > from + range.end * 1000)
      ) {
        audio.current.currentTime = (from + range.start * 1000) / 1000;
      }
    },
    [from],
  );

  const name = label ?? t("녹음 구간");
  const reason = !recording
    ? t("이 미팅에 저장한 녹음이 없거나 볼 수 없어서 재생할 수 없어요.")
    : "";

  return (
    <div>
      <ClipTrimmer
        key={`${recording?.id}:${from}:${length}`}
        src=""
        alt={recording?.title || name}
        duration={length / 1000}
        defaultRange={{ start: 0, end: length / 1000 }}
        minLength={Math.min(1, length / 1000)}
        disabled={!recording || loading}
        media={{
          time: clamped / 1000,
          playing,
          onSeek: (seconds) => seekToMs(seconds * 1000),
          onToggle: () => (playing ? pause() : void play()),
        }}
        onRangeChange={onTrimRange}
        onReset={() => {
          setPosition(0);
          if (audio.current && url.current)
            audio.current.currentTime = from / 1000;
        }}
      />
      <button
        type="button"
        className="mt-2 h-8 rounded-full px-3 text-xs text-[var(--text-secondary)] hover:bg-[var(--hover-fill)] disabled:opacity-50"
        disabled={!recording}
        aria-pressed={loop}
        onClick={() => setLoop((value) => !value)}
      >
        {t("반복 재생")}
      </button>
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
          if (loop) void play(trimStart);
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
