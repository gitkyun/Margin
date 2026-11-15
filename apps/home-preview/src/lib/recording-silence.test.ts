import { describe, expect, it } from "vitest";
import {
  SILENCE_LIMIT_MS,
  nextSilence,
  rmsLevel,
  silenceStart,
} from "./recording-silence";

describe("recording silence watch", () => {
  it("reads a flat signal as silence and a loud one as sound", () => {
    expect(rmsLevel(new Uint8Array(64).fill(128))).toBe(0);
    expect(
      rmsLevel(Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 192 : 64))),
    ).toBeCloseTo(0.5);
    expect(rmsLevel([])).toBe(0);
  });

  it("warns after ten quiet seconds and clears when sound returns", () => {
    let state = silenceStart(0);
    state = nextSilence(state, 0, SILENCE_LIMIT_MS - 1);
    expect(state.silent).toBe(false);
    state = nextSilence(state, 0.001, SILENCE_LIMIT_MS);
    expect(state.silent).toBe(true);
    state = nextSilence(state, 0.2, SILENCE_LIMIT_MS + 500);
    expect(state).toEqual({
      lastSoundAt: SILENCE_LIMIT_MS + 500,
      silent: false,
    });
  });

  it("returns the same object when nothing changes", () => {
    const state = silenceStart(0);
    expect(nextSilence(state, 0, 100)).toBe(state);
  });
});
