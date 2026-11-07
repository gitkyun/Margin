// Browser recognition is independent of MediaRecorder: an error must not lose audio.
export interface SpeechSegment {
  text: string;
  final: boolean;
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
  [index: number]: { transcript: string };
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
  "not-allowed":
    "음성 인식 권한이 꺼져 있습니다. 사이트의 마이크 권한을 확인하고 다시 연결해 주세요.",
  "service-not-allowed":
    "이 브라우저에서 음성 인식 서비스를 사용할 수 없습니다. 다른 지원 브라우저에서 다시 시도해 주세요.",
  "audio-capture":
    "음성 인식에서 마이크를 읽지 못했습니다. 녹음 상태를 확인해 주세요.",
  network:
    "음성 인식 연결이 끊겼습니다. 인터넷 연결을 확인한 뒤 다시 연결해 주세요.",
  "language-not-supported":
    "이 브라우저의 음성 인식에서 한국어를 사용할 수 없습니다.",
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
  constructor(
    private Constructor: RecognitionConstructor | undefined,
    private change: (value: SpeechSnapshot) => void,
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
        "이 브라우저는 실시간 음성 인식을 지원하지 않습니다. 녹음은 계속되며, 마친 뒤 직접 글을 적을 수 있습니다.",
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
        "이 환경에서 음성 인식을 열지 못했습니다. 녹음은 계속되며, 다른 지원 브라우저에서 다시 시도할 수 있습니다.",
      );
      this.emit();
      return;
    }
    this.engine = engine;
    this.current = [];
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
      this.current = Array.from(event.results, (result) => ({
        text: result[0]?.transcript ?? "",
        final: result.isFinal,
      })).filter((part) => part.text.trim());
      this.emptyEnds = 0;
      if (this.snapshot().text.length > 50000) {
        this.warn(
          "전사문 길이 한도에 도달했습니다. 녹음을 마치고 내용을 저장해 주세요.",
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
          "음성 인식이 멈췄습니다. 이미 나온 글자는 남아 있습니다. 다시 연결해 주세요.",
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
        "음성 인식을 시작하지 못했습니다. 마이크 권한을 확인한 뒤 다시 연결해 주세요.",
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
          "음성 인식이 반복해서 종료되었습니다. 녹음은 계속됩니다. 준비되면 다시 연결해 주세요.",
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
          "마지막 문장은 인식 확정을 기다리지 못했습니다. 원음과 비교해 주세요.",
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
