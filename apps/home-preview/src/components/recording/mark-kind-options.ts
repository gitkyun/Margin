import { t } from "@/lib/i18n";
import { MARK_KINDS, markKindLabel, type MarkKind } from "@/lib/mark-kinds";
import type { SelectionAction } from "./SelectionPopover";

/**
 * 선택 막대의 형광펜 ▾ 목록(6단계 형광펜 종류). 고르면 그 종류로 칠하고,
 * 이미 칠한 곳이면 종류가 바뀌어요. 지금 종류는 눌린 버튼으로 보여요.
 */
export function markKindOptions(
  current: MarkKind | null,
  paint: (kind: MarkKind) => void,
): Pick<SelectionAction, "options" | "optionsLabel"> {
  return {
    optionsLabel: t("형광펜 종류 고르기"),
    options: MARK_KINDS.map((kind) => ({
      key: `mark-${kind}`,
      swatch: kind,
      label: markKindLabel(kind),
      pressed: current === kind,
      onSelect: () => paint(kind),
    })),
  };
}
