// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  BackLink,
  LinkChip,
  readBackState,
  useBackState,
} from "../src/pages/student/shared";

afterEach(cleanup);

describe("돌아올 곳(location.state)", () => {
  it("연구 화면 주소와 이름이 있을 때만 받는다", () => {
    expect(
      readBackState({
        from: { path: "/r/a/feedback/1", label: "초록 피드백" },
      }),
    ).toEqual({ path: "/r/a/feedback/1", label: "초록 피드백" });
    expect(readBackState(null)).toBeNull();
    expect(
      readBackState({ from: { path: "https://example.com", label: "밖" } }),
    ).toBeNull();
    expect(readBackState({ from: { path: "//evil", label: "밖" } })).toBeNull();
    expect(readBackState({ from: { path: "/r/a", label: "  " } })).toBeNull();
    expect(readBackState({ from: { path: 3, label: "x" } })).toBeNull();
  });

  it("다른 상세에서 왔으면 BackLink가 출발한 기록으로 돌아간다", () => {
    function Feedback() {
      const back = useBackState();
      return (
        <LinkChip to="/r/a/tasks/t1" state={back("초록 피드백")}>
          할 일 열기
        </LinkChip>
      );
    }
    function Task() {
      return <BackLink to="/r/a/tasks">할 일 목록</BackLink>;
    }
    render(
      <MemoryRouter initialEntries={["/r/a/feedback/f1?tab=plan"]}>
        <Routes>
          <Route path="/r/a/feedback/f1" element={<Feedback />} />
          <Route path="/r/a/tasks/t1" element={<Task />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("link", { name: /할 일 열기/ }));
    const back = screen.getByRole("link", { name: /초록 피드백/ });
    expect(back.getAttribute("href")).toBe("/r/a/feedback/f1?tab=plan");
  });

  it("바로 들어왔으면 목록으로 간다", () => {
    render(
      <MemoryRouter initialEntries={["/r/a/tasks/t1"]}>
        <BackLink to="/r/a/tasks">할 일 목록</BackLink>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: /할 일 목록/ }).getAttribute("href"),
    ).toBe("/r/a/tasks");
  });
});
