// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BrowserRecognition } from "../src/lib/live-speech";
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  upload: vi.fn(),
  transcript: vi.fn(),
  guard: vi.fn(),
}));
vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => ({
    data: {
      recordings: [],
      researches: [{ id: "research", ownerId: "student" }],
      members: [],
      meetings: [{ id: "meeting", visibility: "private" }],
    },
    user: { id: "student" },
    mode: "connected",
    save: mocks.save,
  }),
}));
vi.mock("@/lib/navigation-guard", () => ({ useNavigationGuard: mocks.guard }));
vi.mock("@/lib/experience", () => ({
  privateBlob: vi.fn(),
  uploadPrivate: mocks.upload,
}));
vi.mock("@/lib/live-transcript", () => ({
  saveLiveTranscript: mocks.transcript,
  downloadTranscript: vi.fn(),
}));
vi.mock("@/components/SavedTranscript", () => ({
  SavedTranscript: () => null,
}));
import { RecordingPanel } from "../src/components/RecordingPanel";
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
  constructor() {
    Recognition.instances.push(this);
  }
  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
  result(text: string, final: boolean) {
    this.onresult?.({ results: [{ 0: { transcript: text }, isFinal: final }] });
  }
}
class Recorder {
  static instances: Recorder[] = [];
  static isTypeSupported() {
    return true;
  }
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    Recorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  pause() {
    this.state = "paused";
  }
  resume() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob(["test-only-audio"], { type: this.mimeType }),
    });
    this.onstop?.();
  }
}
const getUserMedia = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  Recognition.instances = [];
  Recorder.instances = [];
  Object.defineProperty(window, "SpeechRecognition", {
    configurable: true,
    value: Recognition,
  });
  Object.defineProperty(window, "MediaRecorder", {
    configurable: true,
    value: Recorder,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
  URL.createObjectURL = vi.fn(() => "blob:unit-test");
  URL.revokeObjectURL = vi.fn();
  mocks.upload.mockResolvedValue(undefined);
  mocks.save.mockImplementation(async (_kind, value) => ({
    ...value,
    createdBy: "student",
  }));
  mocks.transcript.mockImplementation(async (value) => ({
    ...value,
    id: "transcript",
    revision: 1,
  }));
});
afterEach(cleanup);
function view() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RecordingPanel researchId="research" meetingId="meeting" />
    </QueryClientProvider>,
  );
}
async function begin() {
  fireEvent.click(screen.getByRole("button", { name: "녹음 시작" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /참여자에게/ }));
  fireEvent.click(screen.getByRole("button", { name: "녹음·전사 시작" }));
  await waitFor(() => expect(Recognition.instances).toHaveLength(1));
}
describe("recording and live Korean text", () => {
  it("renders actual recognition events, allows corrections and saves both source and edited Korean", async () => {
    view();
    await begin();
    act(() => Recognition.instances[0].result("비교 표", false));
    expect(screen.getByRole("log").textContent).toContain("비교 표");
    expect(screen.getByRole("log").textContent).toContain("인식 중");
    act(() => Recognition.instances[0].result("비교표를 보완하세요.", true));
    fireEvent.click(screen.getByRole("button", { name: "녹음 마치기" }));
    const input = await screen.findByRole("textbox", {
      name: "저장할 한국어 전사문",
    });
    fireEvent.change(input, {
      target: { value: "선행연구 비교표를 보완하세요." },
    });
    fireEvent.click(screen.getByRole("button", { name: "녹음·전사 저장" }));
    await waitFor(() => expect(mocks.transcript).toHaveBeenCalledTimes(1));
    const value = mocks.transcript.mock.calls[0][0];
    expect(value.edited_text).toBe("선행연구 비교표를 보완하세요.");
    expect(value.raw_segments).toEqual([
      { text: "비교표를 보완하세요.", final: true },
    ]);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][0]).toBe("recordings");
  });
  it("retains displayed words and audio capture after an recognition network error", async () => {
    view();
    await begin();
    act(() => {
      Recognition.instances[0].result("앞 문장은 남습니다.", true);
      Recognition.instances[0].onerror?.({ error: "network" });
    });
    expect(screen.getByRole("log").textContent).toContain(
      "앞 문장은 남습니다.",
    );
    expect(Recorder.instances[0].state).toBe("recording");
    fireEvent.click(
      screen.getByRole("button", { name: "음성 인식 다시 연결" }),
    );
    expect(Recognition.instances).toHaveLength(2);
  });
  it("does not upload audio again when transcript saving fails", async () => {
    mocks.transcript.mockRejectedValueOnce(new Error("전사문 연결 실패"));
    view();
    await begin();
    act(() => Recognition.instances[0].result("저장할 문장", true));
    fireEvent.click(screen.getByRole("button", { name: "녹음 마치기" }));
    await screen.findByRole("textbox", { name: "저장할 한국어 전사문" });
    fireEvent.click(screen.getByRole("button", { name: "녹음·전사 저장" }));
    await screen.findByRole("button", { name: "저장 다시 시도" });
    expect(
      (
        screen.getByRole("textbox", {
          name: "저장할 한국어 전사문",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("저장할 문장");
    fireEvent.click(screen.getByRole("button", { name: "저장 다시 시도" }));
    await waitFor(() => expect(mocks.transcript).toHaveBeenCalledTimes(2));
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
  it("does not reopen a discarded recording due to a late stop callback", async () => {
    view();
    await begin();
    const guard = mocks.guard.mock.calls.at(-1)?.[0];
    act(() => guard.onDiscard());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "녹음 시작" })).toBeTruthy(),
    );
    expect(
      screen.queryByRole("textbox", { name: "저장할 한국어 전사문" }),
    ).toBeNull();
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("reports microphone denial without inventing a transcript", async () => {
    getUserMedia.mockRejectedValueOnce(
      Object.assign(new Error("denied"), { name: "NotAllowedError" }),
    );
    view();
    await begin().catch(() => {});
    expect(screen.getByRole("alert").textContent).toContain("마이크 권한");
    expect(Recognition.instances).toHaveLength(0);
    expect(mocks.transcript).not.toHaveBeenCalled();
  });
});
