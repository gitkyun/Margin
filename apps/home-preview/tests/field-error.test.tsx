// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/supabase", () => ({
  configured: true,
  assertConnected: () => ({ auth: { signInWithPassword: signIn } }),
  friendlyError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

import { Field } from "../src/components/common";
import { Input } from "../src/components/ui/input";
import { LabeledInput } from "../src/pages/student/shared";
import { LoginPage } from "../src/pages/AuthPages";

afterEach(cleanup);

describe("칸 오류 안내(D-016)", () => {
  it("Field의 오류는 칸 바로 아래에 나오고 칸과 연결된다", () => {
    render(
      <Field
        label="교수 계정 이메일"
        required
        hint="설명"
        error="형식이 달라요."
      >
        <Input aria-label="교수 계정 이메일" />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "교수 계정 이메일" });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("형식이 달라요.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(
      alert.id,
    );
    // 오류가 설명보다 먼저(칸 바로 아래) 나온다.
    expect(alert.nextElementSibling?.className).toBe("field-hint");
  });

  it("오류가 없으면 칸을 오류로 표시하지 않는다", () => {
    render(
      <Field label="응답 댓글">
        <Input aria-label="응답 댓글" />
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "응답 댓글" });
    expect(input.getAttribute("aria-invalid")).not.toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("LabeledInput도 같은 방식으로 오류를 연결한다(F-005)", () => {
    render(
      <LabeledInput
        label="할 일 이름"
        required
        value=""
        onChange={() => {}}
        error="할 일 이름을 적어 주세요."
      />,
    );
    const input = screen.getByRole("textbox");
    const alert = screen.getByRole("alert");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
  });

  it("로그인이 틀리면 두 칸을 오류로 표시하고 이메일 칸으로 포커스를 옮긴다", async () => {
    signIn.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const { container } = render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );
    const email = container.querySelector(
      'input[type="email"]',
    ) as HTMLInputElement;
    const password = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    fireEvent.change(email, { target: { value: "a@b.test" } });
    fireEvent.change(password, { target: { value: "wrong-pass" } });
    await act(async () => {
      fireEvent.submit(email.closest("form")!);
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("이메일과 비밀번호를 확인해 주세요.");
    for (const input of [email, password]) {
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(input.getAttribute("aria-describedby")).toBe(alert.id);
    }
    await waitFor(() => expect(document.activeElement).toBe(email));
    fireEvent.change(email, { target: { value: "a@c.test" } });
    expect(email.getAttribute("aria-invalid")).not.toBe("true");
  });

  it("연결 오류는 칸의 문제가 아니라서 칸을 오류로 표시하지 않는다", async () => {
    signIn.mockResolvedValue({ error: { message: "Failed to fetch" } });
    const { container } = render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );
    const email = container.querySelector(
      'input[type="email"]',
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.submit(email.closest("form")!);
    });
    await screen.findByRole("alert");
    expect(email.getAttribute("aria-invalid")).not.toBe("true");
  });
});
