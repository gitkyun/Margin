/**
 * 녹음 중 무음 감지. 마이크 입력 크기(RMS)를 주기적으로 넣으면
 * 10초 넘게 조용한지 알려 줘요. 다시 소리가 나면 바로 풀려요.
 */

/** 이만큼 조용하면 경고해요(ms). */
export const SILENCE_LIMIT_MS = 10_000;
/** 이 크기(0~1 RMS) 이상이면 소리가 있다고 봐요. 방 안 잡음보다 조금 높게 잡아요. */
export const SOUND_LEVEL = 0.015;

/** getByteTimeDomainData 표본(128이 0)의 RMS 크기, 0~1 */
export function rmsLevel(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

export interface SilenceState {
  lastSoundAt: number;
  silent: boolean;
}

export function silenceStart(now: number): SilenceState {
  return { lastSoundAt: now, silent: false };
}

/** 새 표본 크기로 다음 상태를 만들어요(원래 상태는 바꾸지 않아요). */
export function nextSilence(
  state: SilenceState,
  level: number,
  now: number,
  limit = SILENCE_LIMIT_MS,
): SilenceState {
  if (level >= SOUND_LEVEL) return { lastSoundAt: now, silent: false };
  const silent = now - state.lastSoundAt >= limit;
  return silent === state.silent ? state : { ...state, silent };
}
