// @vitest-environment jsdom
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Link } from "react-router-dom";
import { Button } from "../src/components/ui/button";
import { THEME_COOKIE_KEY } from "../src/lib/theme";

const bootstrap = readFileSync(
  resolve(__dirname, "../public/theme-bootstrap.js"),
  "utf8",
);
let prefersDark = false;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("dark") ? prefersDark : false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
});

function clearCookies() {
  for (const part of document.cookie.split("; ")) {
    const name = part.split("=")[0];
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`;
  }
}

function runBootstrap() {
  // 브라우저처럼 전역 스코프에서 실행합니다.
  new Function(bootstrap)();
  return document.documentElement.getAttribute("data-theme");
}

describe("theme bootstrap", () => {
  beforeEach(() => {
    localStorage.clear();
    clearCookies();
    prefersDark = false;
    document.documentElement.removeAttribute("data-theme");
  });

  it("uses the same cookie key as the provider", () => {
    expect(bootstrap).toContain(`"${THEME_COOKIE_KEY}"`);
  });

  it("moves the old rms-theme value into the cookie once", () => {
    localStorage.setItem("rms-theme", "dark");
    expect(runBootstrap()).toBe("dark");
    expect(document.cookie).toContain(`${THEME_COOKIE_KEY}=dark`);
    expect(localStorage.getItem("margin-theme-migrated")).toBe("1");

    // 이후 설정을 바꿔도 예전 값으로 되돌리지 않습니다.
    document.cookie = `${THEME_COOKIE_KEY}=light; Path=/`;
    expect(runBootstrap()).toBe("light");
  });

  it("keeps an existing cookie over the old local value", () => {
    document.cookie = `${THEME_COOKIE_KEY}=light; Path=/`;
    localStorage.setItem("rms-theme", "dark");
    expect(runBootstrap()).toBe("light");
  });

  it("follows the system setting for system or no value", () => {
    prefersDark = true;
    expect(runBootstrap()).toBe("dark");
    document.cookie = `${THEME_COOKIE_KEY}=system; Path=/`;
    expect(runBootstrap()).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("ignores unknown values", () => {
    document.cookie = `${THEME_COOKIE_KEY}=sepia; Path=/`;
    expect(runBootstrap()).toBe("light");
  });
});

describe("Button on Montage", () => {
  afterEach(cleanup);

  it("names a text button by its visible text", () => {
    render(<Button>저장</Button>);
    expect(screen.getByRole("button", { name: "저장" })).toBeTruthy();
  });

  it("keeps an explicit aria-label", () => {
    render(
      <Button variant="ghost" size="icon-sm" aria-label="다음 페이지">
        <svg aria-hidden="true" />
      </Button>,
    );
    expect(screen.getByRole("button", { name: "다음 페이지" })).toBeTruthy();
  });

  it("renders asChild links as links without a button type", () => {
    render(
      <MemoryRouter>
        <Button asChild variant="outline">
          <Link to="/r/1/settings">연구 설정</Link>
        </Button>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "연구 설정" });
    expect(link.getAttribute("href")).toBe("/r/1/settings");
    expect(link.hasAttribute("type")).toBe(false);
    expect(link.getAttribute("data-slot")).toBe("button");
  });

  it("passes submit type and disabled state through", () => {
    render(
      <form>
        <Button type="submit" disabled>
          보내기
        </Button>
      </form>,
    );
    const button = screen.getByRole("button", { name: "보내기" });
    expect(button.getAttribute("type")).toBe("submit");
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
