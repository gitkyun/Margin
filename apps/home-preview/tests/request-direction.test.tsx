// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RequestDirection } from "../src/pages/reviews/RequestDirection";

afterEach(cleanup);

describe("RequestDirection", () => {
  it("shows the research name, purpose and every question", () => {
    render(
      <RequestDirection
        name="가상 연구"
        purpose="가상 연구 목적"
        questions={["질문 하나", "질문 둘"]}
      />,
    );
    expect(screen.getByText("연구 방향 · 가상 연구")).toBeTruthy();
    expect(screen.getByText("가상 연구 목적")).toBeTruthy();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      ["질문 하나", "질문 둘"],
    );
  });

  it("shows only the name to the professor when no direction was written", () => {
    render(<RequestDirection name="가상 연구" questions={["  "]} />);
    expect(screen.getByText("가상 연구")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(/아직 적지 않아/)).toBeNull();
  });

  it("tells the student the direction is empty before sharing", () => {
    render(<RequestDirection name="가상 연구" showEmpty />);
    expect(
      screen.getByText("연구 목적과 질문을 아직 적지 않아 연구 이름만 보여요."),
    ).toBeTruthy();
  });

  it("ignores values that are not text", () => {
    render(
      <RequestDirection
        name="가상 연구"
        purpose={{ secret: "x" }}
        questions={[{ secret: "x" }, 123, "남는 질문"]}
      />,
    );
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      ["남는 질문"],
    );
    expect(document.body.textContent).not.toContain("secret");
  });

  it("renders nothing for an old request without research details", () => {
    const { container } = render(<RequestDirection />);
    expect(container.innerHTML).toBe("");
  });
});
