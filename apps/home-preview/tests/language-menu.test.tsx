// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LanguageMenu } from "../src/components/LanguageMenu";
import { LANGUAGES, setLangForTest } from "../src/lib/i18n";

afterEach(() => {
  cleanup();
  setLangForTest("ko");
});

describe("위쪽 줄의 언어 선택", () => {
  it("언어마다 국기와 그 언어로 적은 이름을 보여 주고, 지금 언어를 눌린 상태로 둔다", () => {
    render(<LanguageMenu />);
    const group = screen.getByRole("group", { name: "화면 언어" });
    const buttons = [...group.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual([
      "🇰🇷한국어",
      "🇯🇵日本語",
    ]);
    expect(
      buttons.map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(["true", "false"]);
    // 국기는 꾸밈이라 화면 낭독기에는 언어 이름만 읽힙니다.
    expect(screen.getByRole("button", { name: "한국어" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "日本語" }).lang).toBe("ja");
  });

  it("일본어 화면에서는 日本語가 눌린 상태다", () => {
    setLangForTest("ja");
    render(<LanguageMenu />);
    expect(
      screen
        .getByRole("button", { name: "日本語" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(LANGUAGES.map((language) => language.flag)).toEqual(["🇰🇷", "🇯🇵"]);
  });
});
