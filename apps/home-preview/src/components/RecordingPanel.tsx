import { dateLocale, t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import { privateBlob, uploadPrivate } from "@/lib/experience";
import { recordBase, type Recording } from "@/lib/domain";
import {
  KoreanLiveSpeech,
  recognitionConstructor,
  type SpeechSnapshot,
} from "@/lib/live-speech";
import { saveLiveTranscript, downloadTranscript } from "@/lib/live-transcript";
import { Icon } from "./icons";
import { Button } from "./ui/button";
import { VisibilityField } from "./experience";
import { StatusBadge } from "./common";
import { SavedTranscript } from "./SavedTranscript";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Checkbox } from "@montage-ui/core";

const durationText = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
const emptySpeech = (): SpeechSnapshot => ({
  segments: [],
  text: "",
  state: "stopped",
  message: "",
  warnings: [],
});
type CaptureState =
  | "idle"
  | "starting"
  | "recording"
  | "paused"
  | "finishing"
  | "review"
  | "uploading";
export function RecordingPanel({
  researchId,
  meetingId,
  onAppend,
}: {
  researchId: string;
  meetingId: string;
  onAppend?: (text: string) => void;
}) {
  const { data, user, mode, save } = useWorkspace(),
    cache = useQueryClient();
  const [consent, setConsent] = useState(false),
    [agree, setAgree] = useState(false),
    [state, setState] = useState<CaptureState>("idle"),
    [seconds, setSeconds] = useState(0),
    [blob, setBlob] = useState<Blob | null>(null),
    [audioUrl, setAudioUrl] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    [visibility, setVisibility] = useState<"private" | "shared">("private"),
    [playId, setPlayId] = useState("");
  const [liveText, setLiveText] = useState(true),
    [speech, setSpeech] = useState<SpeechSnapshot>(emptySpeech),
    [transcript, setTranscript] = useState("");
  const media = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    ctx = useRef<AudioContext | null>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    chunks = useRef<Blob[]>([]),
    animation = useRef(0),
    record = useRef<Recording | null>(null),
    uploaded = useRef(false),
    live = useRef(true),
    generation = useRef(0),
    recognition = useRef<KoreanLiveSpeech | null>(null),
    recognitionConsent = useRef<string | null>(null),
    recordingConsent = useRef(""),
    linked = useRef(false),
    playbackUrls = useRef(new Map<string, string>()),
    captured = useRef<SpeechSnapshot>(emptySpeech()),
    clock = useRef({ elapsed: 0, started: 0 });
  const speechSupported = Boolean(recognitionConstructor()),
    busy =
      state === "starting" || state === "finishing" || state === "uploading";
  function elapsed() {
    return Math.floor(
      (clock.current.elapsed +
        (clock.current.started
          ? performance.now() - clock.current.started
          : 0)) /
        1000,
    );
  }
  function discard() {
    generation.current++;
    recognition.current?.dispose();
    recognition.current = null;
    if (media.current && media.current.state !== "inactive")
      media.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    cancelAnimationFrame(animation.current);
    void ctx.current?.close().catch(() => {});
    setBlob(null);
    setState("idle");
    setSpeech(emptySpeech());
    setTranscript("");
    record.current = null;
    uploaded.current = false;
    linked.current = false;
  }
  useNavigationGuard({
    dirty: state !== "idle",
    busy,
    label: t("녹음과 전사문"),
    onDiscard: discard,
  });
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
      recognition.current?.dispose();
      if (media.current && media.current.state !== "inactive")
        media.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      cancelAnimationFrame(animation.current);
      void ctx.current?.close().catch(() => {});
      playbackUrls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => {
      const n = elapsed();
      setSeconds(n);
      if (n >= 7200) stop();
    }, 500);
    return () => clearInterval(timer);
  }, [state]);
  useEffect(() => {
    if (!blob) {
      setAudioUrl("");
      return;
    }
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  async function start() {
    if (!agree || state !== "idle") return;
    setState("starting");
    setError("");
    setConsent(false);
    const gen = ++generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          t(
            "이 브라우저에서는 녹음할 수 없어요. 최신 Chrome이나 Safari에서 열어 주세요.",
          ),
        );
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!live.current || gen !== generation.current) {
        s.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = s;
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
      // 32kbps keeps a full 2-hour recording (about 29MB) well under the 500MB upload
      // limit.
      const m = new MediaRecorder(s, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 32000,
      });
      media.current = m;
      chunks.current = [];
      setSeconds(0);
      setVisibility("private");
      record.current = null;
      uploaded.current = false;
      linked.current = false;
      setBlob(null);
      setSpeech(emptySpeech());
      setTranscript("");
      captured.current = emptySpeech();
      recognition.current?.dispose();
      recognition.current = null;
      recordingConsent.current = new Date().toISOString();
      recognitionConsent.current =
        liveText && speechSupported ? recordingConsent.current : null;
      if (recognitionConsent.current)
        recognition.current = new KoreanLiveSpeech(
          recognitionConstructor(),
          (snapshot) => {
            if (live.current && gen === generation.current) setSpeech(snapshot);
          },
        );
      m.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      m.onstop = async () => {
        s.getTracks().forEach((track) => track.stop());
        cancelAnimationFrame(animation.current);
        void ctx.current?.close().catch(() => {});
        if (!live.current || gen !== generation.current) return;
        setState("finishing");
        const final = await (recognition.current?.finish() ??
          Promise.resolve(emptySpeech()));
        if (!live.current || gen !== generation.current) return;
        captured.current = final;
        setSpeech(final);
        setTranscript(final.text);
        setBlob(new Blob(chunks.current, { type: m.mimeType.split(";")[0] }));
        setState("review");
      };
      m.onerror = () => {
        setError(
          t(
            "녹음이 중간에 멈췄어요. 멈추기 전까지의 음성과 전사문을 확인하고 저장해 주세요.",
          ),
        );
        stop();
      };
      m.start(1000);
      clock.current = { elapsed: 0, started: performance.now() };
      setState("recording");
      recognition.current?.start();
      // Visualization is optional. An AudioContext failure must not stop capture.
      try {
        const ac = new AudioContext(),
          analyser = ac.createAnalyser();
        ctx.current = ac;
        analyser.fftSize = 256;
        ac.createMediaStreamSource(s).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        function draw() {
          if (!live.current || gen !== generation.current) return;
          analyser.getByteTimeDomainData(samples);
          const c = canvas.current,
            g = c?.getContext("2d");
          if (g && c) {
            g.clearRect(0, 0, c.width, c.height);
            g.fillStyle =
              getComputedStyle(c).getPropertyValue("--primary").trim() ||
              "#0066ff";
            const bars = 56,
              step = c.width / bars,
              per = Math.floor(samples.length / bars);
            for (let b = 0; b < bars; b++) {
              let peak = 0;
              if (m.state === "recording")
                for (let j = 0; j < per; j++)
                  peak = Math.max(peak, Math.abs(samples[b * per + j] - 128));
              const h = Math.max(3, (peak / 128) * c.height);
              g.fillRect(
                b * step + step * 0.3,
                (c.height - h) / 2,
                step * 0.4,
                h,
              );
            }
          }
          animation.current = requestAnimationFrame(draw);
        }
        draw();
      } catch {
        /* Audio capture and recognition remain available without visualization. */
      }
    } catch (e) {
      recognition.current?.dispose();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (media.current && media.current.state !== "inactive")
        media.current.stop();
      generation.current++;
      setError(
        (e as Error).name === "NotAllowedError"
          ? t(
              "마이크 권한이 꺼져 있어요. 브라우저의 사이트 설정에서 마이크를 허용한 뒤 다시 시도해 주세요.",
            )
          : (e as Error).message,
      );
      setState("idle");
    }
  }
  function stop() {
    if (!media.current || media.current.state === "inactive") return;
    if (clock.current.started)
      clock.current.elapsed += performance.now() - clock.current.started;
    clock.current.started = 0;
    setSeconds(elapsed());
    setState("finishing");
    media.current.stop();
  }
  function togglePause() {
    const m = media.current;
    if (m?.state === "recording") {
      if (clock.current.started)
        clock.current.elapsed += performance.now() - clock.current.started;
      clock.current.started = 0;
      setSeconds(elapsed());
      m.pause();
      void recognition.current?.pause();
      setState("paused");
    } else if (m?.state === "paused") {
      m.resume();
      clock.current.started = performance.now();
      recognition.current?.start();
      setState("recording");
    }
  }
  async function store() {
    if (!blob?.size) return;
    setState("uploading");
    setError("");
    try {
      let r = record.current;
      if (!r) {
        const type = blob.type.split(";")[0] || "audio/webm",
          ext =
            type === "audio/mp4"
              ? "mp4"
              : type === "audio/ogg"
                ? "ogg"
                : "webm",
          b = recordBase(researchId);
        r = {
          ...b,
          meetingId,
          title: t("미팅 녹음 · {date}", {
            date: new Date().toLocaleDateString(dateLocale()),
          }),
          storagePath: `${user.id}/${researchId}/${b.id}.${ext}`,
          fileName: t("미팅녹음.{ext}", { ext }),
          mimeType: type,
          size: blob.size,
          duration: seconds,
          consentAt: recordingConsent.current,
          visibility,
        };
        record.current = r;
      }
      if (!uploaded.current) {
        await uploadPrivate(
          new File([blob], r.fileName, { type: r.mimeType }),
          r.storagePath,
          mode,
          setProgress,
        );
        uploaded.current = true;
      }
      const saved = await save("recordings", { ...r, visibility });
      record.current = saved;
      linked.current = true;
      if (recognitionConsent.current || transcript.trim()) {
        const savedTranscript = await saveLiveTranscript(
          {
            recording_id: r.id,
            raw_segments: captured.current.segments,
            edited_text: transcript,
            consent_at: recognitionConsent.current ?? r.consentAt,
            warnings: captured.current.warnings,
            revision: 0,
          },
          researchId,
          user.id,
          mode,
        );
        cache.setQueryData(
          ["live-transcript", mode, user.id, r.id],
          savedTranscript,
        );
      }
      recognition.current?.dispose();
      recognition.current = null;
      setBlob(null);
      setState("idle");
      setProgress(null);
      setSpeech(emptySpeech());
      setTranscript("");
      toast.success(
        recognitionConsent.current || transcript.trim()
          ? t("녹음과 전사문을 저장했어요")
          : t("녹음을 저장했어요"),
      );
    } catch (e) {
      setError(
        `${friendlyError(e)} ${uploaded.current ? t("음성 파일은 이미 올라갔고, 이 화면의 내용도 그대로 있어요. ‘저장 다시 시도’를 누르면 파일은 다시 올리지 않고 나머지만 저장해요.") : t("녹음과 전사문은 이 화면에 그대로 있어요.")}`,
      );
      setState("review");
    }
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
  return (
    <section className="recording-panel">
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
      {error && (
        <p className="rms-error" role="alert">
          {error}
        </p>
      )}
      {state === "idle" ? (
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
      ) : (
        <>
          <div className="recording-wave">
            <canvas
              width={620}
              height={72}
              ref={canvas}
              aria-label={t("마이크 입력 파형")}
            />
            <strong>{durationText(seconds)}</strong>
          </div>
          {liveCapture || state === "starting" ? (
            <>
              <div className="button-row">
                <Button variant="outline" disabled={busy} onClick={togglePause}>
                  <Icon
                    name={state === "paused" ? "play" : "pause"}
                    size={16}
                  />
                  {state === "paused" ? t("계속 녹음") : t("일시정지")}
                </Button>
                <Button disabled={busy} onClick={stop}>
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
                    {!recognitionConsent.current
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
                    speech.segments.map((part, i) => (
                      <span
                        key={i}
                        className={
                          part.final ? "speech-final" : "speech-interim"
                        }
                      >
                        {part.text}
                        {!part.final && <small> {t("인식 중")}</small>}
                        <br />
                      </span>
                    ))
                  ) : (
                    <p className="student-footnote">
                      {recognitionConsent.current
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
                        onClick={() => recognition.current?.start()}
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
                src={audioUrl}
                aria-label={t("방금 녹음한 내용")}
              />
              <label className="transcript-field">
                {t("한국어 전사문")}
                <textarea
                  rows={8}
                  maxLength={100000}
                  value={transcript}
                  disabled={state === "uploading"}
                  onChange={(e) => setTranscript(e.target.value)}
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
              {!!speech.warnings.length && (
                <p className="transcript-notice">
                  {t(
                    "인식이 끊긴 구간이 있을 수 있어요. 녹음을 들으며 빠진 말을 확인해 주세요.",
                  )}
                </p>
              )}
              <VisibilityField value={visibility} onChange={setVisibility} />
              <p className="student-footnote">
                {t(
                  "공개 범위는 음성 파일에만 적용돼요. 음성을 공유해도 전사문은 나만 볼 수 있어요.",
                )}
              </p>
              {progress !== null && state === "uploading" && (
                <progress max={100} value={progress} />
              )}
              <div className="button-row">
                <Button
                  variant="ghost"
                  disabled={state === "uploading"}
                  onClick={discard}
                >
                  {linked.current
                    ? t("전사문 버리고 닫기")
                    : t("녹음·전사 버리기")}
                </Button>
                <Button
                  variant="outline"
                  disabled={!transcript.trim()}
                  onClick={() => downloadTranscript(transcript, t("미팅 녹음"))}
                >
                  {t("전사문 TXT 내려받기")}
                </Button>
                <Button
                  disabled={state === "uploading" || !blob?.size}
                  onClick={() => void store()}
                >
                  {state === "uploading"
                    ? t("저장 중")
                    : uploaded.current
                      ? t("저장 다시 시도")
                      : t("녹음·전사 저장")}
                </Button>
              </div>
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
                "녹음하기 전에 참여자에게 알리고 동의를 받아 주세요. 실시간 전사를 켜면 음성이 브라우저 제공자의 음성 인식 서버로 전송될 수 있고 인터넷 연결이 필요해요. 녹음은 한 번에 최대 2시간이고, 2시간이 되면 자동으로 멈춰요. 음성 파일이 500MB를 넘으면 저장할 수 없으니 긴 미팅은 나눠서 녹음해 주세요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <label className="student-choice-row">
            <Checkbox
              checked={liveText && speechSupported}
              disabled={!speechSupported}
              onCheckedChange={(next) => setLiveText(next)}
            />
            {t("실시간 한국어 전사 켜기")}
          </label>
          {!speechSupported && (
            <p className="transcript-notice">
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
              ? t("참여자에게 녹음과 음성 인식을 알리고 동의를 받았어요.")
              : t("참여자에게 녹음을 알리고 동의를 받았어요.")}
          </label>
          <div className="bottom-actions">
            <Button variant="outline" onClick={() => setConsent(false)}>
              {t("취소")}
            </Button>
            <Button
              disabled={!agree || state !== "idle"}
              onClick={() => void start()}
            >
              {liveText && speechSupported
                ? t("녹음·전사 시작")
                : t("음성 녹음 시작")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
