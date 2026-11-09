import { describe, expect, it } from "vitest";
import { localizeServerMessage } from "./server-messages";

describe("localizeServerMessage", () => {
  it("rewrites known server messages in the app's voice and terms", () => {
    expect(localizeServerMessage("이 기록을 변경할 수 없습니다.")).toBe(
      "이 기록을 변경할 수 없어요.",
    );
    expect(
      localizeServerMessage(
        "보존 파일은 덮어쓸 수 없습니다. 새 버전을 추가해 주세요.",
      ),
    ).toBe("파일은 덮어쓸 수 없어요. 새 버전을 추가해 주세요.");
  });
  it("names the field instead of showing the server's raw key", () => {
    expect(localizeServerMessage("title 입력을 확인해 주세요.")).toBe(
      "제목 입력을 확인해 주세요.",
    );
    expect(
      localizeServerMessage("professorEmail 입력 길이를 확인해 주세요."),
    ).toBe("교수 계정 이메일 입력 길이를 확인해 주세요.");
    expect(localizeServerMessage("unknownKey 입력을 확인해 주세요.")).toBe(
      "입력한 내용을 확인해 주세요.",
    );
  });
  it("leaves Korean messages and unknown text unchanged", () => {
    expect(localizeServerMessage("기록 입력을 확인해 주세요.")).toBe(
      "기록 입력을 확인해 주세요.",
    );
    expect(localizeServerMessage("처음 보는 메시지")).toBe("처음 보는 메시지");
  });
});
