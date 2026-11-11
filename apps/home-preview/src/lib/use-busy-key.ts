import { useRef, useState } from "react";

/**
 * 한 화면에서 한 번에 하나의 저장만 보내도록 막습니다.
 *
 * `busy`는 지금 진행 중인 작업 이름(버튼 문구·비활성에 씀)이고, 실제 막기는
 * 바로 바뀌는 ref가 맡아요. 상태만 보면 같은 순간 두 번 누른 클릭이 둘 다
 * 이전 렌더의 빈 값을 보고 요청을 두 번 보냅니다(QA F-010).
 * 막힌 호출은 `undefined`를 돌려줍니다.
 */
export function useBusyKey() {
  const [busy, setBusy] = useState("");
  const pending = useRef(false);
  async function run<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T | undefined> {
    if (pending.current) return undefined;
    pending.current = true;
    setBusy(key);
    try {
      return await operation();
    } finally {
      pending.current = false;
      setBusy("");
    }
  }
  return { busy, run };
}
