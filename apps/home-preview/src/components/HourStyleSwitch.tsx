import { t } from "@/lib/i18n";
import { useState } from "react";
import { Segments } from "@/components/experience";
import { Icon } from "@/components/icons";
import {
  formatClock,
  hourStyle,
  readHourPreference,
  saveHourPreference,
  type HourPreference,
} from "@/lib/time-format";

const OPTIONS: { value: HourPreference; label: string }[] = [
  { value: "24h", label: t("24시간제") },
  { value: "12h", label: t("12시간제") },
  { value: "auto", label: t("기기 설정 따르기") },
];

/** 미리보기 카드의 예시 미팅 시각(오후 2시) */
const PREVIEW_TIME = "14:00";

/**
 * 계정 설정의 시각 표기 선택. 이 브라우저에만 저장하고, 고른 값을
 * 예시 문장과 미팅 카드 모양 미리보기에 바로 보여 줍니다(시각은 바뀔 때 살짝 튀어나와요).
 */
export function HourStyleSwitch() {
  const [preference, setPreference] = useState(readHourPreference);
  const previewTime = formatClock(PREVIEW_TIME, hourStyle());
  return (
    <>
      <div className="hour-style-row">
        <Segments
          label={t("시각 표기")}
          value={preference}
          onChange={(next) => {
            saveHourPreference(next as HourPreference);
            setPreference(next as HourPreference);
          }}
          options={OPTIONS}
        />
        <figure className="hour-preview">
          <div className="hour-preview-card" aria-hidden="true">
            <span className="hour-preview-icon">
              <Icon name="calendar" size={16} />
            </span>
            <span className="hour-preview-text">
              <strong>{t("제6차 논문 지도")}</strong>
              <span>
                {t("미팅")} ·{" "}
                <time key={previewTime} className="hour-pop">
                  {previewTime}
                </time>
              </span>
            </span>
          </div>
          <figcaption>{t("예시 카드예요. 실제 미팅이 아니에요.")}</figcaption>
        </figure>
      </div>
      <p className="settings-note" role="status">
        <span key={preference} className="text-swap">
          {t("지금은 오후 2시 30분을 ‘{time}’으로 보여 줘요.", {
            time: formatClock("14:30", hourStyle()),
          })}
        </span>
      </p>
    </>
  );
}
