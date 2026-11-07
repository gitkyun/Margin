import { assertConnected } from "./supabase";
import { idbGet, idbSet, rpc } from "./repository";
import type { SpeechSegment } from "./live-speech";

export interface LiveTranscript {
  id: string;
  recording_id: string;
  research_id: string;
  user_id: string;
  language: "ko-KR";
  engine: "browser-speech-recognition";
  raw_segments: SpeechSegment[];
  edited_text: string;
  warnings: string[];
  consent_at: string;
  revision: number;
  created_at: string;
  updated_at: string;
}
export type TranscriptInput = Pick<
  LiveTranscript,
  | "recording_id"
  | "raw_segments"
  | "edited_text"
  | "consent_at"
  | "warnings"
  | "revision"
>;
const key = (userId: string, recordingId: string) =>
  `transcript:${userId}:${recordingId}`;
export function downloadTranscript(text: string, title: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|]/g, "_")}_전사문.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function getLiveTranscript(
  recordingId: string,
  userId: string,
  mode: "connected" | "preview",
): Promise<LiveTranscript | null> {
  if (mode === "preview")
    return (
      (await idbGet<LiveTranscript>("workspace", key(userId, recordingId))) ??
      null
    );
  const { data, error } = await assertConnected()
    .from("rms_live_transcripts")
    .select("*")
    .eq("recording_id", recordingId)
    .eq("user_id", userId)
    .abortSignal(AbortSignal.timeout(25000))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LiveTranscript | null;
}
export async function saveLiveTranscript(
  input: TranscriptInput,
  researchId: string,
  userId: string,
  mode: "connected" | "preview",
): Promise<LiveTranscript> {
  if (mode === "connected")
    return rpc<LiveTranscript>("rms_save_live_transcript", {
      p_recording_id: input.recording_id,
      p_segments: input.raw_segments,
      p_text: input.edited_text,
      p_consent_at: input.consent_at,
      p_warnings: input.warnings,
      p_revision: input.revision,
    });
  const old = await getLiveTranscript(input.recording_id, userId, mode);
  if (
    old &&
    old.edited_text !== input.edited_text &&
    old.revision !== input.revision
  )
    throw new Error(
      "다른 창에서 전사문을 수정했습니다. 최신본과 비교해 주세요.",
    );
  const value: LiveTranscript = {
    ...input,
    id: old?.id ?? crypto.randomUUID(),
    research_id: researchId,
    user_id: userId,
    language: "ko-KR",
    engine: "browser-speech-recognition",
    created_at: old?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    revision: old
      ? old.revision + (old.edited_text === input.edited_text ? 0 : 1)
      : 1,
    raw_segments: old?.raw_segments ?? input.raw_segments,
    consent_at: old?.consent_at ?? input.consent_at,
    warnings: old?.warnings ?? input.warnings,
  };
  await idbSet("workspace", key(userId, input.recording_id), value);
  return value;
}
