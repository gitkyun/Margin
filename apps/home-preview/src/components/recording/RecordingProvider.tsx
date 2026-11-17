import { dateLocale, t } from "@/lib/i18n";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import { uploadPrivate } from "@/lib/experience";
import { recordBase, type Recording } from "@/lib/domain";
import {
  KoreanLiveSpeech,
  recognitionConstructor,
  type SpeechSnapshot,
} from "@/lib/live-speech";
import { saveLiveTranscript } from "@/lib/live-transcript";
import { plainSegments, segmentTimesFrom } from "@/lib/recording-timeline";
import { momentMarks } from "@/lib/moment-marks";
import {
  nextSilence,
  rmsLevel,
  silenceStart,
  type SilenceState,
} from "@/lib/recording-silence";
import { playCue } from "@/lib/ui-sound";

/** 한 번에 녹음할 수 있는 최대 길이(초). 넘으면 자동으로 멈춰요. */
export const MAX_RECORDING_SECONDS = 7200;
/** 무음 확인 주기(ms) */
const SILENCE_POLL_MS = 250;

export type CaptureState =
  | "idle"
  | "starting"
  | "recording"
  | "paused"
  | "finishing"
  | "review"
  | "uploading";

/** 녹음 경고: 오래 조용함, 마이크 입력 끊김(잠시), 마이크 연결 끊김(녹음 멈춤) */
export type RecorderAlert = "silence" | "muted" | "track-ended" | null;

export interface RecorderSession {
  researchId: string;
  meetingId: string;
}

export interface RecorderValue {
  /** 녹음이 붙은 미팅. 대기 중이면 null */
  session: RecorderSession | null;
  state: CaptureState;
  seconds: number;
  speech: SpeechSnapshot;
  transcript: string;
  setTranscript(value: string): void;
  audioUrl: string;
  hasAudio: boolean;
  error: string;
  progress: number | null;
  visibility: "private" | "shared";
  setVisibility(value: "private" | "shared"): void;
  /** 이번 녹음에서 실시간 전사를 켰는지 */
  recognitionOn: boolean;
  alert: RecorderAlert;
  /** 음성 파일을 이미 올렸는지(저장 재시도 때 다시 올리지 않아요) */
  uploaded: boolean;
  /** 녹음 기록까지 저장했는지 */
  linked: boolean;
  /** 녹음 패널이 화면에 보이는지. 안 보이면 상단 미니 컨트롤이 나타나요. */
  panelVisible: boolean;
  setPanelVisible(visible: boolean): void;
  /** 파형용 분석기. 시각화를 못 열면 null */
  analyser(): AnalyserNode | null;
  start(session: RecorderSession, options: { liveText: boolean }): void;
  stop(): void;
  togglePause(): void;
  discard(): void;
  store(): Promise<void>;
  reconnectSpeech(): void;
  /** [지금 표시](04 §6.2)로 기억한 시각 수 */
  moments: number;
  /** 지금 시각을 기억합니다. 저장할 때 그 시각의 전사 문장에 형광펜을 칠해요. */
  markNow(): void;
  /** 앱 전체(app)인지, 녹음 패널 하나에 묶인 것(panel)인지 */
  scope: "app" | "panel";
}

const RecorderContext = createContext<RecorderValue | null>(null);

export const emptySpeech = (): SpeechSnapshot => ({
  segments: [],
  text: "",
  state: "stopped",
  message: "",
  warnings: [],
});

/** 녹음 상태. Provider 밖이면 null이에요(미니 컨트롤은 그때 숨어요). */
export function useOptionalRecorder(): RecorderValue | null {
  return useContext(RecorderContext);
}

export function useRecorder(): RecorderValue {
  const value = useContext(RecorderContext);
  if (!value) throw new Error("RecordingProvider 안에서 사용하세요."); // i18n-ignore
  return value;
}

/** 패널 범위일 때만 쓰는 이동 보호. 패널이 사라지면 녹음도 끝나기 때문이에요. */
function PanelGuard({ value }: { value: RecorderValue }) {
  useNavigationGuard({
    dirty: value.state !== "idle",
    busy:
      value.state === "starting" ||
      value.state === "finishing" ||
      value.state === "uploading",
    label: t("녹음과 전사문"),
    onDiscard: value.discard,
  });
  return null;
}

/**
 * 녹음·실시간 전사 상태를 화면 이동과 상관없이 붙들고 있어요.
 * scope="app"으로 셸 위에 두면 다른 화면으로 가도 녹음이 이어지고,
 * 창을 닫을 때만 브라우저가 경고해요. scope="panel"은 예전처럼 녹음 패널에
 * 묶여서, 화면을 떠나려 하면 이동 보호 대화상자를 띄워요.
 */
export function RecordingProvider({
  children,
  scope = "app",
}: {
  children: ReactNode;
  scope?: "app" | "panel";
}) {
  const { user, mode, save } = useWorkspace(),
    cache = useQueryClient();
  const [session, setSession] = useState<RecorderSession | null>(null),
    [state, setState] = useState<CaptureState>("idle"),
    [seconds, setSeconds] = useState(0),
    [blob, setBlob] = useState<Blob | null>(null),
    [audioUrl, setAudioUrl] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState<number | null>(null),
    [visibility, setVisibility] = useState<"private" | "shared">("private"),
    [speech, setSpeech] = useState<SpeechSnapshot>(emptySpeech),
    [transcript, setTranscript] = useState(""),
    [alert, setAlert] = useState<RecorderAlert>(null),
    [panelVisible, setPanelVisible] = useState(false);
  const media = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    ctx = useRef<AudioContext | null>(null),
    analyserNode = useRef<AnalyserNode | null>(null),
    chunks = useRef<Blob[]>([]),
    record = useRef<Recording | null>(null),
    uploaded = useRef(false),
    live = useRef(true),
    generation = useRef(0),
    recognition = useRef<KoreanLiveSpeech | null>(null),
    recognitionConsent = useRef<string | null>(null),
    recordingConsent = useRef(""),
    linked = useRef(false),
    captured = useRef<SpeechSnapshot>(emptySpeech()),
    momentList = useRef<number[]>([]),
    sessionRef = useRef<RecorderSession | null>(null),
    clock = useRef({ elapsed: 0, started: 0 }),
    silence = useRef<SilenceState>(silenceStart(0));
  sessionRef.current = session;

  function elapsedMs() {
    return (
      clock.current.elapsed +
      (clock.current.started ? performance.now() - clock.current.started : 0)
    );
  }
  const elapsed = () => Math.floor(elapsedMs() / 1000);
  const [moments, setMoments] = useState(0);
  function clearMoments() {
    momentList.current = [];
    setMoments(0);
  }
  function markNow() {
    if (state !== "recording" && state !== "paused") return;
    momentList.current.push(Math.round(elapsedMs()));
    setMoments(momentList.current.length);
  }
  // ⌘/Ctrl+Shift+Enter: 메모 칸 안에서도 동작하는 유일한 단축키(04 §6.2)
  const markNowRef = useRef(markNow);
  markNowRef.current = markNow;
  useEffect(() => {
    if (state !== "recording" && state !== "paused") return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        event.shiftKey &&
        (event.metaKey || event.ctrlKey) &&
        !event.isComposing
      ) {
        event.preventDefault();
        markNowRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  function releaseDevices() {
    stream.current?.getTracks().forEach((track) => {
      track.onended = null;
      track.onmute = null;
      track.onunmute = null;
      track.stop();
    });
    analyserNode.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
  }

  function discard() {
    generation.current++;
    recognition.current?.dispose();
    recognition.current = null;
    if (media.current && media.current.state !== "inactive")
      media.current.stop();
    releaseDevices();
    setBlob(null);
    setState("idle");
    setSpeech(emptySpeech());
    setTranscript("");
    setAlert(null);
    setError("");
    setSession(null);
    clearMoments();
    record.current = null;
    uploaded.current = false;
    linked.current = false;
  }

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      generation.current++;
      recognition.current?.dispose();
      if (media.current && media.current.state !== "inactive")
        media.current.stop();
      releaseDevices();
    };
  }, []);

  // 앱 범위에서는 화면 이동은 막지 않고, 창을 닫거나 새로고침할 때만 경고해요.
  useEffect(() => {
    if (scope !== "app" || state === "idle") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [scope, state]);

  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => {
      const n = elapsed();
      setSeconds(n);
      if (n >= MAX_RECORDING_SECONDS) stop();
    }, 500);
    return () => clearInterval(timer);
  }, [state]);

  // 10초 넘게 조용하면 경고하고, 다시 소리가 나면 바로 거둬요.
  useEffect(() => {
    if (state !== "recording") return;
    silence.current = silenceStart(performance.now());
    const samples = new Uint8Array(256);
    const timer = setInterval(() => {
      const node = analyserNode.current;
      if (!node) return;
      node.getByteTimeDomainData(samples);
      const next = nextSilence(
        silence.current,
        rmsLevel(samples),
        performance.now(),
      );
      if (next === silence.current) return;
      silence.current = next;
      setAlert((current) =>
        current === "track-ended" || current === "muted"
          ? current
          : next.silent
            ? "silence"
            : null,
      );
    }, SILENCE_POLL_MS);
    return () => {
      clearInterval(timer);
      setAlert((current) => (current === "silence" ? null : current));
    };
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

  function openAnalyser(s: MediaStream) {
    // 시각화·무음 감지는 선택 기능이에요. 실패해도 녹음은 계속돼요.
    try {
      const ac = new AudioContext(),
        node = ac.createAnalyser();
      node.fftSize = 256;
      ac.createMediaStreamSource(s).connect(node);
      if (ac.state === "suspended") void ac.resume();
      ctx.current = ac;
      analyserNode.current = node;
    } catch {
      analyserNode.current = null;
    }
  }

  function watchTrack(s: MediaStream, gen: number) {
    const mine = () => live.current && gen === generation.current;
    // 트랙 감시도 선택 기능이에요. 지원하지 않는 환경이면 건너뛰어요.
    const tracks =
      typeof s.getAudioTracks === "function" ? s.getAudioTracks() : [];
    for (const track of tracks) {
      track.onended = () => {
        if (mine()) setAlert("track-ended");
      };
      track.onmute = () => {
        if (mine())
          setAlert((current) =>
            current === "track-ended" ? current : "muted",
          );
      };
      track.onunmute = () => {
        if (mine())
          setAlert((current) => (current === "muted" ? null : current));
      };
    }
  }

  async function begin(next: RecorderSession, liveText: boolean) {
    const speechSupported = Boolean(recognitionConstructor());
    setState("starting");
    setError("");
    setAlert(null);
    setSession(next);
    const gen = ++generation.current;
    // 시작음은 마이크를 열기 전에 울려서 녹음에 섞이지 않게 해요.
    playCue("record-start");
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
      // 32kbps면 2시간 녹음도 약 29MB라 500MB 업로드 한도보다 훨씬 작아요.
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
      clearMoments();
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
          elapsedMs,
        );
      m.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      m.onstop = async () => {
        releaseDevices();
        if (!live.current || gen !== generation.current) return;
        if (clock.current.started)
          clock.current.elapsed += performance.now() - clock.current.started;
        clock.current.started = 0;
        setSeconds(elapsed());
        setState("finishing");
        playCue("record-stop");
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
      openAnalyser(s);
      watchTrack(s, gen);
    } catch (e) {
      recognition.current?.dispose();
      releaseDevices();
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

  function start(next: RecorderSession, options: { liveText: boolean }) {
    if (state !== "idle") return;
    void begin(next, options.liveText);
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

  function newRecord(current: Blob, target: RecorderSession): Recording {
    const type = current.type.split(";")[0] || "audio/webm",
      ext =
        type === "audio/mp4" ? "mp4" : type === "audio/ogg" ? "ogg" : "webm",
      b = recordBase(target.researchId),
      segmentTimes = segmentTimesFrom(captured.current.segments);
    return {
      ...b,
      meetingId: target.meetingId,
      title: t("미팅 녹음 · {date}", {
        date: new Date().toLocaleDateString(dateLocale()),
      }),
      storagePath: `${user.id}/${target.researchId}/${b.id}.${ext}`,
      fileName: t("미팅녹음.{ext}", { ext }),
      mimeType: type,
      size: current.size,
      duration: seconds,
      consentAt: recordingConsent.current,
      visibility,
      ...(segmentTimes ? { segmentTimes } : {}),
    };
  }

  async function store() {
    const target = sessionRef.current;
    if (!blob?.size || !target) return;
    setState("uploading");
    setError("");
    try {
      const r = record.current ?? newRecord(blob, target);
      record.current = r;
      if (!uploaded.current) {
        await uploadPrivate(
          new File([blob], r.fileName, { type: r.mimeType }),
          r.storagePath,
          mode,
          setProgress,
        );
        uploaded.current = true;
      }
      const marks = momentList.current.length
        ? momentMarks(
            transcript,
            captured.current.segments,
            momentList.current,
            r.transcriptMarks,
          )
        : [];
      const saved = await save("recordings", {
        ...r,
        visibility,
        ...(marks.length ? { transcriptMarks: marks } : {}),
      });
      record.current = saved;
      linked.current = true;
      if (recognitionConsent.current || transcript.trim()) {
        const savedTranscript = await saveLiveTranscript(
          {
            recording_id: r.id,
            raw_segments: plainSegments(captured.current.segments),
            edited_text: transcript,
            consent_at: recognitionConsent.current ?? r.consentAt,
            warnings: captured.current.warnings,
            revision: 0,
          },
          target.researchId,
          user.id,
          mode,
        );
        cache.setQueryData(
          ["live-transcript", mode, user.id, r.id],
          savedTranscript,
        );
      }
      const hadText = Boolean(recognitionConsent.current || transcript.trim());
      recognition.current?.dispose();
      recognition.current = null;
      setBlob(null);
      setState("idle");
      setProgress(null);
      setSpeech(emptySpeech());
      setTranscript("");
      setAlert(null);
      setSession(null);
      clearMoments();
      toast.success(
        hadText ? t("녹음과 전사문을 저장했어요") : t("녹음을 저장했어요"),
      );
    } catch (e) {
      setError(
        `${friendlyError(e)} ${uploaded.current ? t("음성 파일은 이미 올라갔고, 이 화면의 내용도 그대로 있어요. ‘저장 다시 시도’를 누르면 파일은 다시 올리지 않고 나머지만 저장해요.") : t("녹음과 전사문은 이 화면에 그대로 있어요.")}`,
      );
      setState("review");
    }
  }

  const value: RecorderValue = {
    session,
    state,
    seconds,
    speech,
    transcript,
    setTranscript,
    audioUrl,
    hasAudio: Boolean(blob?.size),
    error,
    progress,
    visibility,
    setVisibility,
    recognitionOn: Boolean(recognitionConsent.current),
    alert,
    uploaded: uploaded.current,
    linked: linked.current,
    panelVisible,
    setPanelVisible,
    analyser: () => analyserNode.current,
    start,
    stop,
    togglePause,
    discard,
    store,
    reconnectSpeech: () => recognition.current?.start(),
    moments,
    markNow,
    scope,
  };
  return (
    <RecorderContext.Provider value={value}>
      {scope === "panel" && <PanelGuard value={value} />}
      {children}
    </RecorderContext.Provider>
  );
}
