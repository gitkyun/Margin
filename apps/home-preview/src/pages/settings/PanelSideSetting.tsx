import { t } from "@/lib/i18n";
import { Segments } from "@/components/experience";
import { useWorkspace } from "@/lib/workspace";
import {
  PANEL_SIDE_KEY,
  setPanelSide,
  usePanelSide,
  type PanelSide,
} from "@/lib/panel-side";
import { usePreferences } from "./use-preferences";

const OPTIONS: { value: PanelSide; label: string }[] = [
  { value: "right", label: t("오른쪽") },
  { value: "left", label: t("왼쪽") },
];

/**
 * 설정 › 화면의 사이드 창 위치(07 §1.2). 고르면 틀에 바로 보이고 계정에 저장돼요.
 * 저장에 실패하면 원래 위치로 되돌립니다. 미리보기는 이 자리에서만 바뀌어요.
 */
export function PanelSideSetting() {
  const { mode } = useWorkspace();
  const side = usePanelSide();
  const { persist, error, busy } = usePreferences();
  const choose = async (next: PanelSide) => {
    const previous = side;
    setPanelSide(next);
    if (mode === "preview") return;
    if (!(await persist({ [PANEL_SIDE_KEY]: next }))) setPanelSide(previous);
  };
  return (
    <section className="settings-section">
      <h2>{t("사이드 창 위치")}</h2>
      <p>
        {mode === "preview"
          ? t("미리보기에서는 이 화면에서만 바뀌고 저장되지 않아요.")
          : t(
              "연구 도우미·할 일 같은 사이드 창을 어느 쪽에 둘지 골라요. 계정에 저장돼요.",
            )}
      </p>
      <Segments
        label={t("사이드 창 위치")}
        value={side}
        onChange={(next) => {
          if (!busy) void choose(next as PanelSide);
        }}
        options={OPTIONS}
      />
      {error && (
        <p className="rms-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
