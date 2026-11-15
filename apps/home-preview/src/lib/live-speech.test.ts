import { afterEach, describe, expect, it, vi } from "vitest";
import { KoreanLiveSpeech, type BrowserRecognition } from "./live-speech";
class Recognition implements BrowserRecognition {
  static instances: Recognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: (() => void) | null = null;
  onresult: BrowserRecognition["onresult"] = null;
  onerror: BrowserRecognition["onerror"] = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn();
  abort = vi.fn(() => this.onend?.());
  constructor() {
    Recognition.instances.push(this);
  }
  result(parts: [string, boolean][]) {
    this.onresult?.({
      results: parts.map(([text, final]) => ({
        0: { transcript: text },
        isFinal: final,
      })),
    });
  }
}
afterEach(() => {
  Recognition.instances = [];
  vi.useRealTimers();
});
describe("live Korean recognition", () => {
  it("requests Korean interim and continuous results; replaces interim rather than duplicating it", () => {
    const speech = new KoreanLiveSpeech(Recognition, vi.fn());
    speech.start();
    const r = Recognition.instances[0];
    expect([r.lang, r.continuous, r.interimResults, r.maxAlternatives]).toEqual(
      ["ko-KR", true, true, 1],
    );
    r.result([["연구 계", false]]);
    r.result([
      ["연구 계획", true],
      ["선행", false],
    ]);
    r.result([
      ["연구 계획", true],
      ["선행 연구 보완", true],
    ]);
    expect(speech.snapshot().text).toBe("연구 계획\n선행 연구 보완");
    speech.dispose();
  });
  it("waits for the final result after stop and preserves raw final flags", async () => {
    const speech = new KoreanLiveSpeech(Recognition, vi.fn());
    speech.start();
    const r = Recognition.instances[0];
    r.result([["비교 표", false]]);
    const end = speech.finish();
    r.result([["비교표를 수정하세요.", true]]);
    r.onend?.();
    expect((await end).segments).toEqual([
      { text: "비교표를 수정하세요.", final: true },
    ]);
    speech.dispose();
  });
  it("retains unconfirmed last words on a stop timeout", async () => {
    vi.useFakeTimers();
    const speech = new KoreanLiveSpeech(Recognition, vi.fn());
    speech.start();
    Recognition.instances[0].result([["마지막 문장", false]]);
    const end = speech.finish();
    await vi.advanceTimersByTimeAsync(1800);
    const result = await end;
    expect(result.text).toBe("마지막 문장");
    expect(result.segments[0].final).toBe(false);
    expect(result.warnings).toHaveLength(1);
    speech.dispose();
  });
  it("continues a new session without erasing previous text after a pause/resume", async () => {
    vi.useFakeTimers();
    const speech = new KoreanLiveSpeech(Recognition, vi.fn());
    speech.start();
    const first = Recognition.instances[0];
    first.result([["앞 문장", true]]);
    const paused = speech.pause();
    speech.start();
    first.onend?.();
    await paused;
    await vi.advanceTimersByTimeAsync(500);
    Recognition.instances[1].result([["뒷 문장", true]]);
    expect(speech.snapshot().text).toBe("앞 문장\n뒷 문장");
    speech.dispose();
  });
  it("does not restart after finishing or disposal", async () => {
    vi.useFakeTimers();
    const listener = vi.fn(),
      speech = new KoreanLiveSpeech(Recognition, listener);
    speech.start();
    const end = speech.finish();
    Recognition.instances[0].onend?.();
    await end;
    await vi.advanceTimersByTimeAsync(3000);
    expect(Recognition.instances).toHaveLength(1);
    speech.dispose();
    listener.mockClear();
    Recognition.instances[0].result([["늦은 이벤트", true]]);
    expect(listener).not.toHaveBeenCalled();
  });
  it("keeps captured text on a network error and only reconnects on request", () => {
    const speech = new KoreanLiveSpeech(Recognition, vi.fn());
    speech.start();
    const first = Recognition.instances[0];
    first.result([["이미 인식된 내용", true]]);
    first.onerror?.({ error: "network" });
    expect(speech.snapshot().state).toBe("error");
    expect(speech.snapshot().text).toBe("이미 인식된 내용");
    speech.start();
    Recognition.instances[1].result([["재연결 이후", true]]);
    expect(speech.snapshot().text).toContain("이미 인식된 내용");
    speech.dispose();
  });
  it("bounds automatic restarts when a service immediately disconnects", async () => {
    vi.useFakeTimers();
    const speech = new KoreanLiveSpeech(Recognition, vi.fn());
    speech.start();
    for (let i = 0; i < 3; i++) {
      Recognition.instances[i].onend?.();
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(Recognition.instances).toHaveLength(3);
    expect(speech.snapshot().state).toBe("error");
    speech.dispose();
  });
  it("reports unsupported recognition without creating words or requiring Gemini", () => {
    const speech = new KoreanLiveSpeech(undefined, vi.fn());
    speech.start();
    expect(speech.snapshot().state).toBe("unsupported");
    expect(speech.snapshot().text).toBe("");
    speech.dispose();
  });
  it("records recording offsets per sentence and keeps the end once final", () => {
    let now = 1000;
    const speech = new KoreanLiveSpeech(Recognition, vi.fn(), () => now);
    speech.start();
    const r = Recognition.instances[0];
    r.result([["연구", false]]);
    now = 2500;
    r.result([["연구 계획", true]]);
    now = 4000;
    r.onresult?.({
      results: [
        { 0: { transcript: "연구 계획" }, isFinal: true },
        { 0: { transcript: "표본", confidence: 0.42 }, isFinal: false },
      ],
    });
    expect(speech.snapshot().segments).toEqual([
      { text: "연구 계획", final: true, startMs: 1000, endMs: 2500 },
      {
        text: "표본",
        final: false,
        startMs: 4000,
        endMs: 4000,
        confidence: 0.42,
      },
    ]);
    speech.dispose();
  });
});
