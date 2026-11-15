/**
 * 절제된 효과음. 파일 없이 Web Audio로 짧은 음을 만들어요(내려받는 자산 없음).
 * 기본값은 꺼짐이고 계정 설정 › 화면에서 켭니다. 이 브라우저에만 기억해요.
 * 녹음 중에는 울리지 않게 호출하는 쪽이 순서를 지켜요(시작음은 마이크를 열기 전에).
 */
export type UiCue = "record-start" | "record-stop" | "task-done" | "copy";

const STORAGE_KEY = "margin-ui-sound";

/** 음 높이(Hz)와 길이(초). 두 음이면 차례로 울려요. */
const CUES: Record<UiCue, readonly (readonly [number, number])[]> = {
  "record-start": [
    [660, 0.07],
    [880, 0.09],
  ],
  "record-stop": [
    [880, 0.07],
    [587, 0.1],
  ],
  "task-done": [
    [784, 0.06],
    [1046, 0.1],
  ],
  copy: [[988, 0.06]],
};

const VOLUME = 0.06;

export function isUiSoundOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setUiSound(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, "on");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소를 못 쓰면 켜지 않은 것으로 둡니다.
  }
}

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  return context;
}

/** 효과음을 켠 사용자에게만 울려요. 실패해도 화면 동작에는 영향이 없어요. */
export function playCue(cue: UiCue): void {
  if (!isUiSoundOn()) return;
  try {
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    let at = ctx.currentTime;
    for (const [frequency, length] of CUES[cue]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(VOLUME, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + length + 0.02);
      at += length;
    }
  } catch {
    // 오디오 장치가 없거나 막혀 있으면 소리 없이 지나가요.
  }
}
