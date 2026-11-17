// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AIModelSelector from "../src/components/kokonut/ai-model-selector";

afterEach(cleanup);

describe("Kokonut 모델 선택기 Esc", () => {
  it("열린 목록의 Esc는 목록만 닫고 바깥(대화상자)으로 전하지 않는다", async () => {
    const outside: string[] = [];
    const listen = (event: KeyboardEvent) => outside.push(event.key);
    document.addEventListener("keydown", listen);
    try {
      render(
        <AIModelSelector
          defaultOpen
          models={[
            {
              id: "a",
              name: "Model A",
              efforts: [{ id: "low", label: "Low" }],
            },
            {
              id: "b",
              name: "Model B",
              efforts: [{ id: "low", label: "Low" }],
            },
          ]}
        />,
      );
      expect(screen.getAllByRole("radio").length).toBe(2);
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      expect(outside).toEqual([]);
      await new Promise((resolve) => setTimeout(resolve, 0));
      // 닫힌 뒤의 Esc는 다시 바깥으로 갑니다.
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      expect(outside).toEqual(["Escape"]);
    } finally {
      document.removeEventListener("keydown", listen);
    }
  });
});
