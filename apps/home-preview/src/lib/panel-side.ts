import { useSyncExternalStore } from "react";
import { useWorkspace } from "./workspace";
import { assertConnected } from "./supabase";

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

/**
 * 아이콘 줄의 화면 배치 메뉴처럼 설정 창 밖에서 바꾼 위치를 계정에 저장합니다.
 * 저장 직전에 계정의 다른 설정을 다시 읽어 그 위에 이 값만 덮어써요(다른 설정을 지우지 않게).
 */
export async function savePanelSide(side: PanelSide): Promise<void> {
  const client = assertConnected();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const preferences = data.user?.user_metadata?.preferences ?? {};
  const { error: saveError } = await client.auth.updateUser({
    data: { preferences: { ...preferences, [PANEL_SIDE_KEY]: side } },
  });
  if (saveError) throw saveError;
}
