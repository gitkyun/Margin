import { useSyncExternalStore } from "react";
import { useWorkspace } from "./workspace";

// 사이드 창 위치(IA v2 07 §1.2 '화면', 0단계 완료 기준 ④).
// 계정 메타데이터 preferences.panelSide에 저장합니다. 설정 창에서 바꾼 값은
// 저장을 기다리지 않고 틀에 바로 보이도록 여기 둡니다(미리보기는 저장 없이 여기만).

export type PanelSide = "right" | "left";
export const PANEL_SIDE_KEY = "panelSide";

let override: PanelSide | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setPanelSide(side: PanelSide | null): void {
  override = side;
  listeners.forEach((listener) => listener());
}

export function readPanelSide(value: unknown): PanelSide {
  return value === "left" ? "left" : "right";
}

export function usePanelSide(): PanelSide {
  const { user } = useWorkspace();
  const current = useSyncExternalStore(
    subscribe,
    () => override,
    () => override,
  );
  return current ?? readPanelSide(user.preferences?.[PANEL_SIDE_KEY]);
}
