import { describe, expect, it } from "vitest";
import {
  matchesAny,
  readMultiParam,
  toggleValue,
  writeMultiParam,
} from "./filter-params";

describe("다중 선택 필터와 주소", () => {
  it("허용한 값만 중복 없이 읽는다", () => {
    const params = new URLSearchParams("status=held,unknown,held,recorded");
    expect(
      readMultiParam(params, "status", new Set(["held", "recorded"])),
    ).toEqual(["held", "recorded"]);
    expect(readMultiParam(params, "meeting")).toEqual([]);
  });

  it("원래 주소를 바꾸지 않고 새 주소를 만들며, 비면 키를 지운다", () => {
    const params = new URLSearchParams("q=1&status=held");
    const next = writeMultiParam(params, "status", ["held", "recorded"]);
    expect(params.get("status")).toBe("held");
    expect(next.get("status")).toBe("held,recorded");
    expect(next.get("q")).toBe("1");
    expect(writeMultiParam(next, "status", []).has("status")).toBe(false);
  });

  it("아무것도 고르지 않으면 모두 통과한다", () => {
    expect(matchesAny([], "held")).toBe(true);
    expect(matchesAny(["recorded"], "held")).toBe(false);
  });

  it("선택을 켜고 끈다", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });
});
