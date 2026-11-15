import { t } from "@/lib/i18n";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "@/lib/workspace";
import { clockText } from "@/lib/recording-timeline";
import { Icon } from "../icons";
import { LiveWaveform } from "./LiveWaveform";
import { VoiceGlow, analyserLevel } from "./VoiceGlow";
import { Hint } from "../ui/hint";
import { useOptionalRecorder } from "./RecordingProvider";
import "./recording.css";

/**
 * 상단 줄의 미니 녹음 컨트롤. 녹음 중이거나 저장 전인 녹음이 있고,
 * 그 녹음 패널이 화면에 보이지 않을 때만 나타나요(파형·경과 시간·일시정지·마치기·미팅으로).
 * 녹음 중에는 알약 아래 가장자리에 목소리 크기만큼 빛이 차올라요.
 * RecordingProvider(scope="app") 밖이면 아무것도 그리지 않아요.
 */
export function MiniRecorder() {
  const recorder = useOptionalRecorder();
  const { data } = useWorkspace();
  const analyser = recorder?.analyser;
  // 빛이 매 프레임 음량을 물어봐요. 렌더마다 새로 만들지 않아요.
  const level = useMemo(
    () => (analyser ? analyserLevel(analyser) : () => 0),
    [analyser],
  );
  if (!recorder?.session || recorder.state === "idle" || recorder.panelVisible)
    return null;
  const { session, state, seconds } = recorder;
  const meeting = data.meetings.find((m) => m.id === session.meetingId);
  const capturing =
    state === "recording" || state === "paused" || state === "starting";
  const label =
    state === "recording"
      ? t("녹음 중")
      : state === "paused"
        ? t("일시정지")
        : state === "starting"
          ? t("마이크 연결 중")
          : state === "finishing"
            ? t("마무리 중")
            : state === "uploading"
              ? t("저장 중")
              : t("저장 전 녹음");
  const href = `/r/${session.researchId}/meetings/${session.meetingId}?tab=record#meeting-recording`;
  const recording = state === "recording";
  return (
    <VoiceGlow
      className="mini-recorder-glow"
      type="pill"
      level={level}
      active={recording}
      processing={state === "finishing" || state === "uploading"}
    >
      <div
        className="mini-recorder"
        data-state={state}
        data-alert={recorder.alert ?? undefined}
        role="group"
        aria-label={t("미니 녹음 컨트롤")}
      >
        {/* 녹음 중에는 파형이, 그 밖에는 상태 글자가 지금 상태를 알려요. */}
        {capturing && state !== "starting" ? (
          <LiveWaveform
            className="mini-recorder-wave"
            analyser={recorder.analyser}
            active={recording}
            bars={14}
            label={label}
          />
        ) : (
          <span className="mini-recorder-dot" aria-hidden />
        )}
        <span className="mini-recorder-copy">
          <span className="mini-recorder-time">
            {clockText(seconds * 1000)}
          </span>
          <strong className={recording ? "sr-only" : undefined}>{label}</strong>
          {meeting && (
            <span className="mini-recorder-title" title={meeting.title}>
              {meeting.title}
            </span>
          )}
        </span>
        {recorder.alert && (
          <span className="sr-only" role="status">
            {t("녹음 경고가 있어요. 미팅으로 돌아가 확인해 주세요.")}
          </span>
        )}
        {capturing && (
          <>
            <button
              type="button"
              className="mini-recorder-button"
              disabled={state === "starting"}
              aria-label={state === "paused" ? t("계속 녹음") : t("일시정지")}
              onClick={recorder.togglePause}
            >
              <Icon name={state === "paused" ? "play" : "pause"} size={16} />
            </button>
            <button
              type="button"
              className="mini-recorder-button mini-recorder-stop"
              disabled={state === "starting"}
              aria-label={t("녹음 마치기")}
              onClick={recorder.stop}
            >
              <Icon name="stop" size={14} />
            </button>
          </>
        )}
        <Hint
          label={state === "review" ? t("저장하러 가기") : t("미팅으로")}
          position="bottom-center"
        >
          <Link
            className="mini-recorder-button"
            to={href}
            aria-label={state === "review" ? t("저장하러 가기") : t("미팅으로")}
          >
            <Icon name="arrow-right" size={16} />
          </Link>
        </Hint>
      </div>
    </VoiceGlow>
  );
}
