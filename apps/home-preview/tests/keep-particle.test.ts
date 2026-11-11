import { describe, expect, it } from "vitest";
import { keepParticle } from "../src/lib/keep-particle";

const JOINER = "⁠";

describe("keepParticle", () => {
  it("joins a closing quote to the particle after it", () => {
    expect(keepParticle("교수님이 ‘추가 수정 필요’를 남겼어요.")).toBe(
      `교수님이 ‘추가 수정 필요’${JOINER}를 남겼어요.`,
    );
    expect(keepParticle("‘수정 내용 확인’을 남겼어요.")).toBe(
      `‘수정 내용 확인’${JOINER}을 남겼어요.`,
    );
  });

  it("leaves text without a quote-and-particle pair unchanged", () => {
    expect(keepParticle("‘추가 수정 필요’ 표시")).toBe("‘추가 수정 필요’ 표시");
    expect(keepParticle("先生が「追加修正が必要」を残しました。")).toBe(
      `先生が「追加修正が必要」を残しました。`,
    );
  });
});
