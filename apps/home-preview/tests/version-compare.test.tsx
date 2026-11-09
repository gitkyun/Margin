// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  VersionCompareSlider,
  VersionSheet,
} from "../src/components/VersionCompareSlider";

afterEach(cleanup);

describe("VersionCompareSlider", () => {
  it("renders both versions behind one Korean-labelled slider", () => {
    render(
      <VersionCompareSlider
        label="v1 · 지금 쓰는 내용 비교"
        defaultPosition={40}
        before={<VersionSheet tone="before" label="v1" text="이전 문장" />}
        after={<VersionSheet tone="after" label="지금 쓰는 내용" text="" />}
      />,
    );
    const slider = screen.getByRole("slider", {
      name: "v1 · 지금 쓰는 내용 비교",
    });
    expect(slider.getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText("이전 문장")).toBeTruthy();
    // 빈 버전도 빈칸 대신 안내 문장을 보여 줍니다.
    expect(screen.getByText("내용이 없어요.")).toBeTruthy();
  });

  it("moves 10% with PageUp and clamps at the start", () => {
    render(
      <VersionCompareSlider
        defaultPosition={15}
        before={<p>이전</p>}
        after={<p>이후</p>}
      />,
    );
    const slider = screen.getByRole("slider");
    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(slider.getAttribute("aria-valuenow")).toBe("5");
    fireEvent.keyDown(slider, { key: "PageUp" });
    expect(slider.getAttribute("aria-valuenow")).toBe("0");
  });
});
