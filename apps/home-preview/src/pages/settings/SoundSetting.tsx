import { t } from "@/lib/i18n";
import { useState } from "react";
import { Switch } from "@montage-ui/core";
import { isUiSoundOn, playCue, setUiSound } from "@/lib/ui-sound";

/**
 * 계정 설정 › 화면 설정의 효과음 스위치. 기본은 꺼짐이고 바꾸면 바로 저장돼요(이 브라우저에만).
 * 켜는 순간 링크 복사음을 한 번 들려줘 어떤 소리인지 미리 알 수 있게 합니다.
 */
export function SoundSetting() {
  const [on, setOn] = useState(isUiSoundOn);
  return (
    <section className="settings-section">
      <h2>{t("효과음")}</h2>
      <p>
        {t(
          "녹음 시작·종료, 할 일 완료, 링크 복사에서만 짧게 울려요. 바꾸면 바로 저장되고, 이 브라우저에만 적용돼요.",
        )}
      </p>
      <div className="preferences-list">
        <label>
          <span>{t("효과음 켜기")}</span>
          <Switch
            checked={on}
            onCheckedChange={(next: boolean) => {
              setUiSound(next);
              setOn(next);
              // 켜면 어떤 소리인지 한 번 들려줘요(꺼질 때는 울리지 않음).
              if (next) playCue("copy");
            }}
          />
        </label>
      </div>
    </section>
  );
}
