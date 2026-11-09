import { useHotkeys } from "react-hotkeys-hook";
import { useNavigate } from "react-router-dom";
import { GO_SHORTCUTS, researchPath } from "./go-shortcuts";

/** G를 누르고 다음 글자를 기다리는 시간 */
const SEQUENCE_MS = 1000;

/** 단축키 하나. react-hotkeys-hook은 한 호출 안의 여러 연속 키가 버퍼를 같이 써서 따로 등록합니다. */
function useGoShortcut(
  researchId: string | undefined,
  path: string,
  key: string,
) {
  const navigate = useNavigate();
  useHotkeys(
    `g>${key}`,
    () => {
      if (researchId) navigate(researchPath(researchId, path));
    },
    {
      enabled: !!researchId,
      preventDefault: true,
      sequenceTimeoutMs: SEQUENCE_MS,
      ignoreEventWhen: (event) => event.isComposing,
    },
    [researchId, navigate, path],
  );
}

/**
 * 연구 안에서 G → 글자로 화면을 옮깁니다. 입력 칸·편집기 안에서는 쓰지 않고(라이브러리 기본),
 * 한글 조합 중인 키도 무시합니다. 연구 밖에서는 꺼 둡니다.
 * GO_SHORTCUTS는 고정 목록이라 훅 호출 순서가 바뀌지 않습니다.
 */
export function useGoShortcuts(researchId: string | undefined) {
  for (const [path, key] of GO_SHORTCUTS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- 고정 길이 목록
    useGoShortcut(researchId, path, key);
  }
}
