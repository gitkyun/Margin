// @vitest-environment jsdom
import React, { useState } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@montage-ui/core";
import { Field } from "../src/components/common";
import { EmailChips } from "../src/components/EmailChips";
import { LabeledInput } from "../src/pages/student/shared";

afterEach(cleanup);

function EmailChipsHarness() {
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  return (
    <Field
      label="지도교수 이메일"
      hint="Enter나 쉼표로 한 명씩 넣어요. 나중에 연구 설정에서 바꿀 수 있어요."
    >
      <EmailChips
        emails={emails}
        onChange={setEmails}
        draft={draft}
        onDraftChange={setDraft}
        placeholder="professor@example.com"
      />
    </Field>
  );
}

describe("입력 오류 문구 및 접근성 연결 (U2-03·U2-04)", () => {
  it("EmailChips에 잘못된 이메일을 넣고 Enter를 누르면 오류 문구와 aria-describedby가 연결되고 수정 시 사라진다", () => {
    render(<EmailChipsHarness />);
    const input = screen.getByLabelText("지도교수 이메일");

    // 초기에는 오류 문구가 없고 안내문만 연결됨
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBeNull();
    const initialDescribedBy = input.getAttribute("aria-describedby") ?? "";
    expect(initialDescribedBy).toMatch(/-hint$/);

    // 잘못된 이메일 입력 후 Enter
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("이메일 주소 형식을 확인해 주세요.");
    expect(alert.className).toContain("field-error");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedByIds = (
      input.getAttribute("aria-describedby") ?? ""
    ).split(/\s+/);
    expect(describedByIds).toContain(alert.id);
    expect(describedByIds).toContain(initialDescribedBy);

    // 입력을 고치거나 지우면 오류 문구가 사라짐
    fireEvent.change(input, { target: { value: "prof@example.com" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(input.getAttribute("aria-invalid")).toBeNull();

    // 정상 이메일 Enter → 칩으로 추가되고 오류 없음
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("prof@example.com")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("LabeledInput은 오류 문구에 field-error 클래스와 alert 역할을 부여하고 CSS가 var(--danger)를 유지한다", () => {
    render(
      <ThemeProvider>
        <LabeledInput
          label="연구 이름"
          value=""
          onChange={() => {}}
          error="연구 이름을 입력해 주세요."
        />
      </ThemeProvider>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("연구 이름을 입력해 주세요.");
    expect(alert.tagName).toBe("SMALL");
    expect(alert.className).toBe("field-error");

    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);

    // experience.css·writing.css의 .field small 규칙이 .field-error를 덮지 않는지 확인
    const experienceCss = readFileSync(
      resolve(__dirname, "../src/experience.css"),
      "utf8",
    );
    const writingCss = readFileSync(
      resolve(__dirname, "../src/pages/writing.css"),
      "utf8",
    );
    const stylesCss = readFileSync(
      resolve(__dirname, "../src/styles.css"),
      "utf8",
    );
    expect(experienceCss).toContain(".field small:not(.field-error)");
    expect(experienceCss).not.toMatch(/\.field small\s*\{/);
    expect(writingCss).toContain(".writing-apply .field small:not(.field-error)");
    expect(writingCss).not.toMatch(/\.writing-apply \.field small\s*\{/);
    expect(stylesCss).toMatch(/\.field-error\s*\{[^}]*color:\s*var\(--danger\)/);
  });
});
