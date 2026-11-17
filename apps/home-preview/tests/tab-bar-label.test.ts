import { afterEach, describe, expect, it } from "vitest";
import { setLangForTest, tc } from "../src/lib/i18n";

const tabBarLabel = (key: string) => tc("tabbar", key);

afterEach(() => setLangForTest("ko"));

describe("tabBarLabel", () => {
  it("keeps the Korean name as is", () => {
    setLangForTest("ko");
    expect(tabBarLabel("연구 도우미")).toBe("연구 도우미");
  });
  it("uses the short Japanese name when the dictionary name is too long", () => {
    setLangForTest("ja");
    expect(tabBarLabel("연구 도우미")).toBe("研究助手");
    expect(tabBarLabel("미팅")).toBe("会議");
  });
  it("falls back to the normal Japanese name", () => {
    setLangForTest("ja");
    expect(tabBarLabel("할 일")).toBe("タスク");
  });
});
