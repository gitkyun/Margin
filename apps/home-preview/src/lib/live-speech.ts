import { t } from "@/lib/i18n";
// Browser recognition is independent of MediaRecorder: an error must not lose audio.
export interface SpeechSegment {
  text: string;
  final: boolean;
  /** 녹음 시작 기준으로 이 문장이 처음 들린 때(ms). 시계를 넘긴 경우에만 있어요. */
  startMs?: number;
  /** 녹음 시작 기준으로 이 문장이 확정된(또는 마지막으로 바뀐) 때(ms) */
  endMs?: number;
  /** 브라우저가 준 인식 신뢰도(0~1). 0이나 없음은 모른다는 뜻이에요. */
  confidence?: number;
}
export type SpeechState =
  "starting" | "listening" | "paused" | "stopped" | "error" | "unsupported";
export interface SpeechSnapshot {
  segments: SpeechSegment[];
  text: string;
  state: SpeechState;
  message: string;
  warnings: string[];
}
interface RecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string; confidence?: number };
}
export interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type RecognitionConstructor = new () => BrowserRecognition;
export function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const host = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition;
}
export function speechText(parts: SpeechSegment[]): string {
  return parts
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n");
}
const messages: Record<string, string> = {
  "not-allowed": t(
    "음성 인식 권한이 꺼져 있어요. 녹음은 계속돼요. 브라우저나 기기 설정에서 음성 인식을 허용한 뒤 다시 연결해 주세요.",
  ),
  "service-not-allowed": t(
    "이 브라우저에서는 음성 인식 서비스를 쓸 수 없어요. 녹음은 계속돼요. 실시간 전사는 지원하는 다른 브라우저에서 다시 시도해 주세요.",
  ),
  "audio-capture": t(
    "음성 인식이 마이크 소리를 받지 못했어요. 녹음이 계속되고 있는지 확인해 주세요.",
  ),
  network: t(
    "음성 인식 연결이 끊겼어요. 녹음은 계속돼요. 인터넷 연결을 확인한 뒤 다시 연결해 주세요.",
  ),
  "language-not-supported": t(
    "이 브라우저의 음성 인식은 한국어를 지원하지 않아요. 녹음은 계속돼요. 실시간 전사는 다른 브라우저에서 시도해 주세요.",
  ),
};
export class KoreanLiveSpeech {
  private engine: BrowserRecognition | null = null;
  private archived: SpeechSegment[] = [];
  private current: SpeechSegment[] = [];
  private warnings: string[] = [];
  private state: SpeechState = "stopped";
  private message = "";
  private wanted = false;
  private disposed = false;
  private restartTimer: ReturnType<typeof setTimeout> | undefined;
  private emptyEnds = 0;
  private stopping: Promise<SpeechSnapshot> | null = null;
  private resolveStop: ((value: SpeechSnapshot) => void) | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | undefined;
  // 현재 인식 세션의 결과 번호별 시각. 세션이 바뀌면 비워요.
  private times: { startMs: number; endMs: number; final: boolean }[] = [];
  constructor(
    private Constructor: RecognitionConstructor | undefined,
    private change: (value: SpeechSnapshot) => void,
    // 녹음 경과 시간(ms)을 돌려주는 시계. 일시정지 시간은 빼고 셉니다.
    private clock?: () => number,
  ) {}
  snapshot(): SpeechSnapshot {
    const segments = [...this.archived, ...this.current].map((part) => ({
      ...part,
    }));
    return {
      segments,
      text: speechText(segments),
      state: this.state,
      message: this.message,
      warnings: [...this.warnings],
    };
  }
  private emit() {
    if (!this.disposed) this.change(this.snapshot());
  }
  private warn(message: string) {
    this.message = message;
    if (!this.warnings.includes(message))
      this.warnings = [...this.warnings, message].slice(-12);
  }
  start() {
    if (this.disposed) return;
    if (!this.Constructor) {
      this.state = "unsupported";
      this.warn(
        t(
          "이 브라우저는 실시간 전사를 지원하지 않아요. 녹음은 계속되고, 녹음을 마친 뒤 전사문을 직접 쓸 수 있어요.",
        ),
      );
      this.emit();
      return;
    }
    this.wanted = true;
    this.emptyEnds = 0;
    this.message = "";
    if (this.engine) return; // A rapid pause/resume waits for the old session to end.
    this.connect();
  }
  private connect() {
    if (!this.wanted || this.engine || this.disposed || !this.Constructor)
      return;
    let engine: BrowserRecognition;
    try {
      engine = new this.Constructor();
    } catch {
      this.wanted = false;
      this.state = "error";
      this.warn(
        t(
          "이 브라우저에서 음성 인식을 열지 못했어요. 녹음은 계속돼요. 실시간 전사는 지원하는 다른 브라우저에서 다시 시도해 주세요.",
        ),
      );
      this.emit();
      return;
    }
    this.engine = engine;
    this.current = [];
    this.times = [];
    this.state = "starting";
    this.emit();
    engine.lang = "ko-KR";
    engine.continuous = true;
    engine.interimResults = true;
    engine.maxAlternatives = 1;
    engine.onstart = () => {
      if (this.engine !== engine || !this.wanted) return;
      this.state = "listening";
      this.message = "";
      this.emit();
    };
    engine.onresult = (event) => {
      if (this.engine !== engine || this.disposed) return;
      // Results for the current session replace earlier interim values. Never append
      // the entire result list repeatedly (it contains already reported finals).
      const now = this.clock?.();
      this.current = Array.from(event.results, (result, index) => {
        const part: SpeechSegment = {
          text: result[0]?.transcript ?? "",
          final: result.isFinal,
        };
        const confidence = result[0]?.confidence;
        if (typeof confidence === "number" && confidence > 0)
          part.confidence = confidence;
        if (typeof now === "number") {
          const seen = this.times[index];
          // 확정된 뒤에는 끝 시각을 고정해요. 확정 전에는 마지막으로 바뀐 때까지 늘려요.
          const time =
            seen?.final === true
              ? seen
              : {
                  startMs: seen?.startMs ?? now,
                  endMs: now,
                  final: result.isFinal,
                };
          this.times[index] = time;
          part.startMs = time.startMs;
          part.endMs = time.endMs;
        }
        return part;
      }).filter((part) => part.text.trim());
      this.emptyEnds = 0;
      if (this.snapshot().text.length > 50000) {
        this.warn(
          t(
            "전사문이 50,000자에 닿아 실시간 전사를 멈췄어요. 녹음을 마치고 저장해 주세요.",
          ),
        );
        void this.finish();
      }
      this.emit();
    };
    engine.onerror = (event) => {
      if (this.engine !== engine || this.disposed || !this.wanted) return;
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.wanted = false;
      this.state = "error";
      this.warn(
        messages[event.error] ??
          t(
            "음성 인식이 멈췄어요. 녹음은 계속되고, 이미 받아 적은 글자도 그대로 있어요. 다시 연결해 주세요.",
          ),
      );
      this.emit();
      try {
        engine.abort();
      } catch {
        /* The service may have already ended. */
      }
    };
    engine.onend = () => this.ended(engine);
    try {
      engine.start();
    } catch {
      this.wanted = false;
      this.state = "error";
      this.warn(
        t(
          "음성 인식을 시작하지 못했어요. 녹음은 계속돼요. 마이크 권한을 확인한 뒤 다시 연결해 주세요.",
        ),
      );
      this.ended(engine);
    }
  }
  private ended(engine: BrowserRecognition) {
    if (this.engine !== engine) return;
    const hadText = this.current.length > 0;
    this.archived.push(...this.current);
    this.current = [];
    this.engine = null;
    if (this.stopTimer) clearTimeout(this.stopTimer);
    if (this.resolveStop) {
      this.resolveStop(this.snapshot());
      this.resolveStop = null;
      this.stopping = null;
    }
    if (this.disposed) return;
    if (this.wanted) {
      this.emptyEnds = hadText ? 0 : this.emptyEnds + 1;
      if (this.emptyEnds >= 3) {
        this.wanted = false;
        this.state = "error";
        this.warn(
          t(
            "한동안 인식된 말이 없어 음성 인식을 멈췄어요. 녹음은 계속돼요. 다시 받아 적으려면 ‘음성 인식 다시 연결’을 눌러 주세요.",
          ),
        );
      } else {
        this.state = "starting";
        this.restartTimer = setTimeout(() => this.connect(), 500);
      }
    }
    this.emit();
  }
  pause(): Promise<SpeechSnapshot> {
    return this.halt("paused");
  }
  finish(): Promise<SpeechSnapshot> {
    return this.halt("stopped");
  }
  private halt(state: "paused" | "stopped"): Promise<SpeechSnapshot> {
    this.wanted = false;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.state !== "unsupported" && this.state !== "error")
      this.state = state;
    if (!this.engine) {
      this.emit();
      return Promise.resolve(this.snapshot());
    }
    if (this.stopping) return this.stopping;
    const engine = this.engine;
    this.stopping = new Promise((resolve) => {
      this.resolveStop = resolve;
    });
    const pending = this.stopping;
    this.stopTimer = setTimeout(() => {
      if (this.engine !== engine) return;
      if (this.current.some((part) => !part.final))
        this.warn(
          t(
            "마지막 문장은 인식이 확정되지 않았어요. 녹음을 들으며 확인해 주세요.",
          ),
        );
      // Seal before abort, whose synchronous end event differs by browser.
      this.ended(engine);
      try {
        engine.abort();
      } catch {
        /* Best effort release. */
      }
    }, 1800);
    try {
      engine.stop();
    } catch {
      this.ended(engine);
    }
    this.emit();
    return pending;
  }
  dispose() {
    this.disposed = true;
    this.wanted = false;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    const engine = this.engine;
    this.engine = null;
    if (this.resolveStop) this.resolveStop(this.snapshot());
    this.resolveStop = null;
    try {
      engine?.abort();
    } catch {
      /* Already released. */
    }
  }
}
