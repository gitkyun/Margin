import { createContext, useContext, useLayoutEffect } from "react";

/**
 * 앱 틀(WorkspaceShell)이 지금 화면에 있는지 알리는 통로(IA v2 02 §7).
 * 틀이 있으면 '새로 불러오기 실패'를 틀의 띠로 보이고, 틀 밖 화면(교수 검토·일정 조율 등)에서만
 * `RmsApp`이 따로 띄웁니다. 값은 틀이 올라올 때 +1, 내려갈 때 −1 하는 함수예요.
 */
export const ShellPresence = createContext<(delta: 1 | -1) => void>(() => {});

/** 틀이 그려져 있는 동안 자신을 알립니다. */
export function useAnnounceShell() {
  const announce = useContext(ShellPresence);
  useLayoutEffect(() => {
    announce(1);
    return () => announce(-1);
  }, [announce]);
}
