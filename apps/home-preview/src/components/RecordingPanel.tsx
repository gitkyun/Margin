import { t } from "@/lib/i18n";
import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import { privateBlob } from "@/lib/experience";
import type { Recording } from "@/lib/domain";
import { recognitionConstructor } from "@/lib/live-speech";
import { downloadTranscript } from "@/lib/live-transcript";
import { isUncertain } from "@/lib/recording-timeline";
import { Icon } from "./icons";
import { Button } from "./ui/button";
import { VisibilityField } from "./experience";
import { StatusBadge, useDisabledReason } from "./common";
import { SavedTranscript, type TranscriptPick } from "./SavedTranscript";
import {
  RecordingProvider,
  useOptionalRecorder,
  useRecorder,
} from "./recording/RecordingProvider";
import { LiveWaveform } from "./recording/LiveWaveform";
import { RecordingAlert } from "./recording/RecordingAlert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "./ui/dialog";
import { Checkbox } from "@montage-ui/core";

export type { TranscriptPick } from "./SavedTranscript";

const durationText = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;

interface RecordingPanelProps {
  researchId: string;
  meetingId: string;
  onAppend?: (text: string) => void;
  /** 저장한 전사문에서 고른 글로 피드백·결정·질문을 만들 때 */
  onPick?: (pick: TranscriptPick) => void;
}

/**
 * 미팅 녹음·실시간 전사 패널.
 * 앱 위에 RecordingProvider(scope="app")가 있으면 그 녹음을 함께 쓰고(다른 화면으로
 * 가도 녹음이 이어져요), 없으면 이 패널에만 묶인 녹음기를 만들어요(예전 동작).
 */
export function RecordingPanel(props: RecordingPanelProps) {
  const shared = useOptionalRecorder();
  if (shared) return <RecordingPanelView {...props} />;
  return (
    <RecordingProvider scope="panel">
      <RecordingPanelView {...props} />
    </RecordingProvider>
  );
}

function RecordingPanelView({
  researchId,
  meetingId,
  onAppend,
  onPick,
}: RecordingPanelProps) {
  const { data, user, mode, save } = useWorkspace();
  const recorder = useRecorder();
  const [consent, setConsent] = useState(false),
    [agree, setAgree] = useState(false),
    [playId, setPlayId] = useState(""),
    [liveText, setLiveText] = useState(true);
  const playbackUrls = useRef(new Map<string, string>()),
    panel = useRef<HTMLElement>(null);
  const mine = recorder.session?.meetingId === meetingId;
  const elsewhere = !!recorder.session && !mine && recorder.state !== "idle";
  const state = mine ? recorder.state : "idle";
  const { speech, transcript, seconds } = recorder;
  const speechSupported = Boolean(recognitionConstructor()),
    busy =
      state === "starting" || state === "finishing" || state === "uploading";
  const downloadReason = useDisabledReason(
      state === "review" &&
        !transcript.trim() &&
        t("전사문을 적으면 TXT로 내려받을 수 있어요."),
    ),
    storeReason = useDisabledReason(
      state === "review" &&
        !recorder.hasAudio &&
        t("녹음된 음성이 없어 저장할 수 없어요."),
    ),
    agreeReason = useDisabledReason(
      state === "idle" &&
        !agree &&
        t("참석자 동의에 체크하면 시작할 수 있어요."),
    ),
    speechNoticeId = useId();

  useEffect(() => {
    const urls = playbackUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  // 이 패널이 화면에 보이는지 알려 줘요. 안 보이면 상단 미니 컨트롤이 나타나요.
  const { setPanelVisible } = recorder;
  useEffect(() => {
    const el = panel.current;
    if (!mine || !el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) =>
      setPanelVisible(entry.isIntersecting),
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      setPanelVisible(false);
    };
  }, [mine, setPanelVisible]);

  function start() {
    if (!agree || state !== "idle" || elsewhere) return;
    setConsent(false);
    recorder.start({ researchId, meetingId }, { liveText });
  }

  async function play(r: Recording) {
    try {
      const b = await privateBlob(r, mode),
        url = URL.createObjectURL(b);
      const oldUrl = playbackUrls.current.get(r.id);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      playbackUrls.current.set(r.id, url);
      setPlayId(r.id);
      const el = document.getElementById(`audio-${r.id}`) as HTMLAudioElement;
      el.src = url;
      await el.play();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const liveCapture =
    state === "recording" || state === "paused" || state === "finishing";
  const otherMeeting = elsewhere
    ? data.meetings.find((m) => m.id === recorder.session?.meetingId)
    : undefined;
  return (
    <section className="recording-panel" ref={panel}>
      <div className="section-heading">
        <h3>
          <Icon name="mic" size={18} /> {t("미팅 녹음·전사")}
        </h3>
        <StatusBadge tone={state === "recording" ? "red" : "neutral"}>
          {state === "recording"
            ? t("녹음 중")
            : state === "paused"
              ? t("일시정지")
              : state === "finishing"
                ? t("마무리 중")
                : t("음성 기록")}
        </StatusBadge>
      </div>
      {mine && recorder.error && (
        <p className="rms-error" role="alert">
          {recorder.error}
        </p>
      )}
      {mine && <RecordingAlert alert={recorder.alert} />}
      {state === "idle" ? (
        elsewhere ? (
          <div className="recording-start recording-elsewhere">
            <p>
              {otherMeeting
                ? t(
                    "‘{title}’ 미팅에서 녹음하고 있어요. 그 녹음을 마치고 저장하면 여기서 새로 녹음할 수 있어요.",
                    { title: otherMeeting.title },
                  )
                : t(
                    "다른 미팅에서 녹음하고 있어요. 그 녹음을 마치고 저장하면 여기서 새로 녹음할 수 있어요.",
                  )}
            </p>
            {recorder.session && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  to={`/r/${recorder.session.researchId}/meetings/${recorder.session.meetingId}?tab=record`}
                >
                  {t("녹음 중인 미팅으로")}
                  <Icon name="arrow-right" size={14} />
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="recording-start">
            <p>
              {t(
                "녹음하면서 말한 내용을 한국어로 받아 적을 수 있어요. 저장하기 전에 녹음을 들어 보고 전사문을 고칠 수 있어요.",
              )}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setAgree(false);
                setConsent(true);
              }}
            >
              <Icon name="mic" size={17} /> {t("녹음 시작")}
            </Button>
          </div>
        )
      ) : (
        <>
          <div
            className="recording-wave"
            data-paused={state !== "recording" || undefined}
          >
            {liveCapture || state === "starting" ? (
              <LiveWaveform
                analyser={recorder.analyser}
                active={state === "recording"}
                label={t("마이크 입력 파형")}
              />
            ) : (
              <span className="grow" />
            )}
            <strong>{durationText(seconds)}</strong>
          </div>
          {liveCapture || state === "starting" ? (
            <>
              <div className="button-row">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={recorder.togglePause}
                >
                  <Icon
                    name={state === "paused" ? "play" : "pause"}
                    size={16}
                  />
                  {state === "paused" ? t("계속 녹음") : t("일시정지")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={recorder.markNow}
                  title="⌘/Ctrl+Shift+Enter"
                >
                  <Icon name="flag" size={16} />
                  {t("지금 표시")}
                  {recorder.moments > 0 && (
                    <span className="record-moments" aria-live="polite">
                      {t("표시 {count}개", { count: recorder.moments })}
                    </span>
                  )}
                </Button>
                <Button disabled={busy} onClick={recorder.stop}>
                  {state === "starting"
                    ? t("마이크 연결 중")
                    : state === "finishing"
                      ? t("마지막 문장 확인 중")
                      : t("녹음 마치기")}
                </Button>
              </div>
              <div className="live-transcript">
                <div className="section-heading">
                  <h4>{t("실시간 한국어 전사")}</h4>
                  <span role="status">
                    {!recorder.recognitionOn
                      ? t("음성만 녹음")
                      : speech.state === "error"
                        ? t("인식 중단")
                        : state === "paused"
                          ? t("일시정지")
                          : state === "finishing"
                            ? t("마무리 중")
                            : speech.state === "listening"
                              ? t("듣는 중")
                              : t("연결 중")}
                  </span>
                </div>
                <div
                  className="live-transcript-text"
                  role="log"
                  aria-label={t("실시간 한국어 전사문")}
                  aria-live="off"
                >
                  {speech.segments.length ? (
                    speech.segments.map((part, i) => {
                      const unsure = isUncertain(part.confidence);
                      return (
                        <span
                          key={i}
                          className={
                            part.final ? "speech-final" : "speech-interim"
                          }
                        >
                          <span
                            className={unsure ? "speech-uncertain" : undefined}
                            title={unsure ? t("인식이 불확실해요") : undefined}
                          >
                            {part.text}
                          </span>
                          {unsure && (
                            <span className="sr-only">
                              {" "}
                              ({t("인식이 불확실해요")})
                            </span>
                          )}
                          {!part.final && <small> {t("인식 중")}</small>}
                          <br />
                        </span>
                      );
                    })
                  ) : (
                    <p className="student-footnote">
                      {recorder.recognitionOn
                        ? t("말을 시작하면 여기에 글자가 나타나요.")
                        : t(
                            "실시간 전사 없이 음성만 녹음하고 있어요. 녹음을 마친 뒤 전사문을 직접 쓸 수 있어요.",
                          )}
                    </p>
                  )}
                </div>
                {speech.message && (
                  <p className="transcript-notice" role="alert">
                    {speech.message}{" "}
                    {state === "recording" && speech.state === "error" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={recorder.reconnectSpeech}
                      >
                        {t("음성 인식 다시 연결")}
                      </Button>
                    )}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="recording-review">
              <audio
                controls
                src={recorder.audioUrl}
                aria-label={t("방금 녹음한 내용")}
              />
              <label className="transcript-field">
                {t("한국어 전사문")}
                <textarea
                  rows={8}
                  maxLength={100000}
                  value={transcript}
                  disabled={state === "uploading"}
                  onChange={(e) => recorder.setTranscript(e.target.value)}
                  placeholder={t(
                    "인식한 문장이 없어요. 녹음을 들으며 직접 쓸 수 있어요.",
                  )}
                />
              </label>
              <p className="student-footnote">
                {t(
                  "잘못 인식한 말은 고쳐 주세요. 처음 인식한 내용도 따로 저장돼요.",
                )}
              </p>
              {speech.segments.some((p) => !p.final) && (
                <p className="transcript-notice">
                  {t(
                    "인식이 확정되지 않은 문장이 있어요. 녹음을 들으며 확인해 주세요.",
                  )}
                </p>
              )}
              {speech.segments.some((p) => isUncertain(p.confidence)) && (
                <p className="transcript-notice">
                  {t(
                    "인식이 불확실한 문장이 있어요. 저장한 뒤 ‘처음 인식한 내용 보기’에서 점선 밑줄로 확인할 수 있어요.",
                  )}
                </p>
              )}
              {!!speech.warnings.length && (
                <p className="transcript-notice">
                  {t(
                    "인식이 끊긴 구간이 있을 수 있어요. 녹음을 들으며 빠진 말을 확인해 주세요.",
                  )}
                </p>
              )}
              <VisibilityField
                value={recorder.visibility}
                onChange={recorder.setVisibility}
              />
              <p className="student-footnote">
                {t(
                  "공개 범위는 음성 파일에만 적용돼요. 음성을 공유해도 전사문은 나만 볼 수 있어요.",
                )}
              </p>
              {recorder.progress !== null && state === "uploading" && (
                <progress max={100} value={recorder.progress} />
              )}
              <div className="button-row">
                <Button
                  variant="ghost"
                  disabled={state === "uploading"}
                  onClick={recorder.discard}
                >
                  {recorder.linked
                    ? t("전사문 버리고 닫기")
                    : t("녹음·전사 버리기")}
                </Button>
                <Button
                  variant="outline"
                  disabled={!transcript.trim()}
                  aria-describedby={downloadReason.describedBy}
                  onClick={() => downloadTranscript(transcript, t("미팅 녹음"))}
                >
                  {t("전사문 TXT 내려받기")}
                </Button>
                <Button
                  disabled={state === "uploading" || !recorder.hasAudio}
                  aria-describedby={storeReason.describedBy}
                  onClick={() => void recorder.store()}
                >
                  {state === "uploading"
                    ? t("저장 중")
                    : recorder.uploaded
                      ? t("저장 다시 시도")
                      : t("녹음·전사 저장")}
                </Button>
              </div>
              {downloadReason.node}
              {storeReason.node}
            </div>
          )}
        </>
      )}
      {data.recordings
        .filter((r) => r.meetingId === meetingId && !r.archivedAt)
        .map((r) => (
          <div key={r.id} className="recording-entry">
            <div className="saved-recording">
              <Icon name="mic" size={18} />
              <div>
                <strong>{r.title}</strong>
                <small>
                  {durationText(r.duration)} ·{" "}
                  {r.visibility === "shared"
                    ? t("음성 공유 중")
                    : t("음성 나만 보기")}
                </small>
                <audio
                  id={`audio-${r.id}`}
                  controls={playId === r.id}
                  aria-label={r.title}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => void play(r)}>
                {t("재생")}
              </Button>
              {r.createdBy === user.id && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await save("recordings", {
                        ...r,
                        visibility:
                          r.visibility === "shared" ? "private" : "shared",
                      });
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  {r.visibility === "shared"
                    ? t("음성 공유 중지")
                    : t("음성 공유")}
                </Button>
              )}
            </div>
            {r.createdBy === user.id && (
              <SavedTranscript
                recording={r}
                memoShared={
                  data.meetings.find((m) => m.id === meetingId)?.visibility ===
                  "shared"
                }
                onAppend={onAppend}
                onPick={onPick}
              />
            )}
          </div>
        ))}
      <Dialog open={consent} onOpenChange={setConsent}>
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>{t("녹음을 시작할까요?")}</DialogTitle>
            <DialogDescription>
              {t(
                "녹음하기 전에 참석자에게 알리고 동의를 받아 주세요. 실시간 전사를 켜면 음성이 브라우저 제공자의 음성 인식 서버로 전송될 수 있고 인터넷 연결이 필요해요. 녹음은 한 번에 최대 2시간이고, 2시간이 되면 자동으로 멈춰요. 음성 파일이 500MB를 넘으면 저장할 수 없으니 긴 미팅은 나눠서 녹음해 주세요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <label className="student-choice-row">
              <Checkbox
                checked={liveText && speechSupported}
                disabled={!speechSupported}
                aria-describedby={speechSupported ? undefined : speechNoticeId}
                onCheckedChange={(next) => setLiveText(next)}
              />
              {t("실시간 한국어 전사 켜기")}
            </label>
            {!speechSupported && (
              <p id={speechNoticeId} className="transcript-notice">
                {t(
                  "이 브라우저는 실시간 전사를 지원하지 않아요. 음성만 녹음하거나 지원하는 브라우저에서 열어 주세요.",
                )}
              </p>
            )}
            <label className="student-choice-row">
              <Checkbox
                checked={agree}
                onCheckedChange={(next) => setAgree(next)}
              />
              {liveText && speechSupported
                ? t("참석자에게 녹음과 음성 인식을 알리고 동의를 받았어요.")
                : t("참석자에게 녹음을 알리고 동의를 받았어요.")}
            </label>
            {agreeReason.node}
            {recorder.scope === "app" && (
              <p className="student-footnote">
                {t(
                  "녹음하는 동안 다른 화면으로 가도 녹음은 이어지고, 위쪽의 작은 녹음 막대에서 멈추거나 이 미팅으로 돌아올 수 있어요.",
                )}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsent(false)}>
              {t("취소")}
            </Button>
            <Button
              disabled={!agree || state !== "idle" || elsewhere}
              aria-describedby={agreeReason.describedBy}
              onClick={start}
            >
              {liveText && speechSupported
                ? t("녹음·전사 시작")
                : t("음성 녹음 시작")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
