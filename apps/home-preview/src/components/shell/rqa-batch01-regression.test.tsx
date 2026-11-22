// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BottomDock } from "./BottomDock";

const shellCss = readFileSync(resolve(__dirname, "shell.css"), "utf8");
const assistantPanelCss = readFileSync(
  resolve(__dirname, "../assistant/assistant-side-panel.css"),
  "utf8",
);
const mainTsx = readFileSync(resolve(__dirname, "../../main.tsx"), "utf8");

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--dock-height");
});

describe("QA Fix Batch 01 regression (RQA-001 · RQA-002 · RQA-004 · RQA-005)", () => {
  it("RQA-001: BottomDock syncs --dock-height to both .ia-shell and documentElement, and Toaster consumes it", () => {
    const { container, unmount } = render(
      <div className="ia-shell">
        <BottomDock>
          <div>dock content</div>
        </BottomDock>
      </div>,
    );
    const shell = container.querySelector<HTMLElement>(".ia-shell")!;
    const dock = container.querySelector<HTMLElement>(".ia-dock")!;
    Object.defineProperty(dock, "offsetHeight", {
      configurable: true,
      value: 56,
    });

    // Initial mount syncs --dock-height onto both .ia-shell and :root (documentElement)
    expect(shell.style.getPropertyValue("--dock-height")).toMatch(/^\d+px$/);
    expect(
      document.documentElement.style.getPropertyValue("--dock-height"),
    ).toMatch(/^\d+px$/);

    unmount();
    expect(shell.style.getPropertyValue("--dock-height")).toBe("");
    expect(
      document.documentElement.style.getPropertyValue("--dock-height"),
    ).toBe("");

    expect(mainTsx).toContain(
      'offset={{ bottom: "calc(24px + var(--dock-height, 0px))" }}',
    );
    expect(mainTsx).toContain(
      'mobileOffset={{ bottom: "calc(16px + var(--dock-height, 0px))" }}',
    );
  });

  it("RQA-001: BottomDock cleans up document-level --dock-height even without ResizeObserver", () => {
    const RO = globalThis.ResizeObserver;
    // @ts-expect-error: 테스트에서 ResizeObserver 부재 환경을 흉내 냅니다.
    globalThis.ResizeObserver = undefined;
    try {
      const { container, unmount } = render(
        <div className="ia-shell">
          <BottomDock>
            <div>dock content</div>
          </BottomDock>
        </div>,
      );
      expect(
        document.documentElement.style.getPropertyValue("--dock-height"),
      ).toMatch(/^\d+px$/);
      unmount();
      expect(
        document.documentElement.style.getPropertyValue("--dock-height"),
      ).toBe("");
      expect(container.querySelector(".ia-shell")).toBeNull();
    } finally {
      globalThis.ResizeObserver = RO;
    }
  });

  it("RQA-002: margin-panel uses flex column and ia-panel-tab takes remaining height below mobile layer head", () => {
    expect(shellCss).toMatch(
      /\.ia-shell\s+\.margin-panel\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
    );
    expect(shellCss).toMatch(
      /\.ia-shell\s+\.ia-panel-tab\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;/s,
    );
    expect(shellCss).toMatch(
      /\.ia-shell\s+\.ia-layer-head\s*\{[^}]*flex:\s*none;/s,
    );
    expect(assistantPanelCss).toMatch(
      /\.margin-panel\s*>\s*div:has\(>\s*\.assistant-side-panel\)\s*\{[^}]*flex:\s*1;[^}]*min-height:\s*0;/s,
    );
  });

  it("RQA-004: desktop workspace-content establishes position: relative containing block inside 100dvh shell", () => {
    expect(shellCss).toMatch(
      /\.main-shell\s*>\s*\.workspace-content\s*\{[^}]*position:\s*relative;[^}]*overflow-y:\s*auto;/s,
    );
  });

  it("RQA-005: ia-topbar adapts via @container topbar available width so 600px panel does not crush switch/search", () => {
    expect(shellCss).toMatch(
      /\.ia-shell\s+\.ia-topbar\s*\{[^}]*container-type:\s*inline-size;[^}]*container-name:\s*topbar;/s,
    );
    expect(shellCss).toContain("@container topbar (max-width: 900px)");
    expect(shellCss).toContain("@container topbar (max-width: 680px)");
    expect(shellCss).toMatch(
      /\.ia-topbar\s+\.ia-switch\s*\{[^}]*min-width:\s*72px;/s,
    );
  });
});
