import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { assertConnected, friendlyError } from "@/lib/supabase";

export type Preferences = Record<string, string | boolean>;

/**
 * 계정 메타데이터(user_metadata.preferences)에 둔 설정을 읽고 저장합니다.
 * 저장은 마지막으로 불러오거나 저장한 값에 바꾼 조각만 덮어써서,
 * 한 화면의 다른 구역(AI 기본값·나만의 연구 도우미)이 서로의 값을 지우지 않게 해요.
 */
export function usePreferences() {
  const { mode } = useWorkspace();
  const [prefs, setPrefs] = useState<Preferences>({});
  const saved = useRef<Preferences>({});
  // 불러오기 전에 저장하면 다른 설정이 빈 값으로 덮일 수 있어 불러온 뒤에만 저장해요.
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "connected") return;
    let alive = true;
    void assertConnected()
      .auth.getUser()
      .then(({ data, error: loadError }) => {
        if (!alive) return;
        if (loadError) {
          setError(friendlyError(loadError));
          return;
        }
        const value: Preferences = data.user?.user_metadata?.preferences ?? {};
        saved.current = value;
        setPrefs(value);
        setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [mode]);

  /** 바꾼 조각을 저장. 성공하면 true, 실패하면 이유를 보여 주고 false */
  async function persist(patch: Preferences): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      if (mode === "preview")
        throw new Error(t("미리보기에서는 설정을 저장할 수 없어요."));
      if (!loaded) throw new Error(t("설정을 불러온 뒤 다시 저장해 주세요."));
      const next = { ...saved.current, ...patch };
      const { error: saveError } = await assertConnected().auth.updateUser({
        data: { preferences: next },
      });
      if (saveError) throw saveError;
      saved.current = next;
      return true;
    } catch (e) {
      setError(friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { prefs, setPrefs, persist, busy, error, setError, loaded };
}
