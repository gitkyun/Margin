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
 * 피드백이 나온 녹음 구간만 재생해요(재생/정지, 구간 스크러버).
 * 녹음을 저장하지 않았거나 볼 수 없는 미팅이면 버튼을 끄고 이유를 한 줄 보여요.
 * 음성 파일은 눌렀을 때 처음 한 번만 불러와요.
 */
export function SourceAudioClip({ source, label }: SourceAudioClipProps) {
  const { data, mode } = useWorkspace();
  const recording = findSourceRecording(data.recordings, source);
  const audio = useRef<HTMLAudioElement>(null);
  const url = useRef("");
  const [loading, setLoading] = useState(false),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
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
      <input
        type="range"
        className="source-audio-scrubber"
        min={0}
        max={length}
        step={100}
        value={Math.min(position, length)}
        disabled={!recording}
        aria-label={t("{name} 재생 위치", { name })}
        aria-valuetext={clockText(from + position)}
        onChange={(e) => {
          const next = Number(e.target.value);
          setPosition(next);
          if (audio.current && url.current)
            audio.current.currentTime = (from + next) / 1000;
        }}
      />
      <span className="source-audio-time">
        {clockText(from + position)} / {clockText(to)}
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
