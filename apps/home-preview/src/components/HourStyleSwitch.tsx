import { useState } from "react";
import { Segments } from "@/components/experience";
import {
  formatClock,
  hourStyle,
  readHourPreference,
  saveHourPreference,
  type HourPreference,
} from "@/lib/time-format";

const OPTIONS: { value: HourPreference; label: string }[] = [
  { value: "24h", label: "24시간제" },
  { value: "12h", label: "12시간제" },
  { value: "auto", label: "기기 설정 따르기" },
];

/** 계정 설정의 시각 표기 선택. 이 브라우저에만 저장하고, 고른 값의 예시를 바로 보여 줍니다. */
export function HourStyleSwitch() {
  const [preference, setPreference] = useState(readHourPreference);
  return (
    <>
      <Segments
        label="시각 표기"
        value={preference}
        onChange={(next) => {
          saveHourPreference(next as HourPreference);
          setPreference(next as HourPreference);
        }}
        options={OPTIONS}
      />
      <p className="settings-note" role="status">
        지금은 오후 2시 30분을 ‘{formatClock("14:30", hourStyle())}’으로 보여
        줘요.
      </p>
    </>
  );
}
