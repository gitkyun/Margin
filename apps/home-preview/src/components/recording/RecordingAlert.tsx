import { t } from "@/lib/i18n";
import { Icon } from "../icons";
import type { RecorderAlert } from "./RecordingProvider";
import "./recording.css";

const messages: Record<Exclude<RecorderAlert, null>, () => string> = {
  silence: () =>
    t(
      "10초 넘게 소리가 들리지 않아요. 마이크가 켜져 있는지 확인해 주세요. 녹음은 계속되고 있어요.",
    ),
  muted: () =>
    t(
      "마이크 입력이 끊겼어요. 마이크 연결을 확인해 주세요. 녹음은 계속되고 있어요.",
    ),
  "track-ended": () =>
    t(
      "마이크 연결이 끊겨 녹음이 멈췄어요. 끊기기 전까지의 녹음을 확인하고 저장해 주세요.",
    ),
};

/**
 * 무음·마이크 끊김 경고. 나타날 때 한 번 흔들리고(동작 줄이기에서는 멈춤),
 * 소리가 돌아오면 Provider가 경고를 거둬서 사라져요.
 */
export function RecordingAlert({ alert }: { alert: RecorderAlert }) {
  if (!alert) return null;
  return (
    <div key={alert} className="recording-alert" role="alert">
      <Icon name="warning" size={18} />
      <p>{messages[alert]()}</p>
    </div>
  );
}
