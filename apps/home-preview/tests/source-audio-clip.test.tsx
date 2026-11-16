// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => ({
    mode: "preview",
    data: {
      recordings: [
        {
          id: "recording",
          meetingId: "meeting",
          duration: 10,
          storagePath: "audio",
        },
      ],
    },
  }),
}));
vi.mock("@/lib/experience", () => ({
  privateBlob: vi.fn(async () => new Blob(["audio"])),
}));
import { SourceAudioClip } from "../src/components/recording/SourceAudioClip";
const source = {
  recordingId: "recording",
  meetingId: "meeting",
  startMs: 0,
  endMs: 10000,
};
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:test"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("끝을 실제 녹음 길이로 제한하고 양끝 손잡이를 키보드로 조절·초기화한다", () => {
  render(<SourceAudioClip source={source} />);
  const start = screen.getByRole("slider", { name: "시작 위치" });
  const end = screen.getByRole("slider", { name: "끝 위치" });
  expect(end.getAttribute("aria-valuemax")).toBe("10");
  fireEvent.keyDown(start, { key: "ArrowRight" });
  fireEvent.keyDown(end, { key: "ArrowLeft" });
  expect(start.getAttribute("aria-valuenow")).toBe("0.1");
  expect(end.getAttribute("aria-valuenow")).toBe("9.9");
  fireEvent.click(screen.getByRole("button", { name: "구간 초기화" }));
  expect(start.getAttribute("aria-valuenow")).toBe("0");
  expect(end.getAttribute("aria-valuenow")).toBe("10");
});
it("실제 녹음 끝에서도 반복 재생이 다시 시작된다", async () => {
  const { container } = render(<SourceAudioClip source={source} />);
  fireEvent.click(screen.getByRole("button", { name: "반복 재생" }));
  const audio = container.querySelector("audio")!;
  fireEvent.ended(audio);
  await waitFor(() => expect(audio.load).toHaveBeenCalled());
  fireEvent.loadedMetadata(audio);
  await waitFor(() => expect(audio.play).toHaveBeenCalled());
  expect(audio.currentTime).toBe(0);
});
