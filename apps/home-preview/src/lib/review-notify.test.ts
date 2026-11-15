// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  canNotifyAgain,
  notifyFailureMessage,
  readNotifyRecord,
  saveNotifyRecord,
} from "./review-notify";

afterEach(() => localStorage.clear());

describe("교수님께 메일로도 알리기", () => {
  it("기록이 없거나 다음 구간이 되면 다시 알릴 수 있다", () => {
    const record = {
      requestedAt: "2026-11-15T01:00:00.000Z",
      nextAt: "2026-11-15T07:00:00.000Z",
    };
    expect(canNotifyAgain(null)).toBe(true);
    expect(canNotifyAgain(record, new Date("2026-11-15T06:59:00Z"))).toBe(
      false,
    );
    expect(canNotifyAgain(record, new Date("2026-11-15T07:00:00Z"))).toBe(true);
  });

  it("요청 기록을 검토 요청별로 저장하고, 깨진 값은 무시한다", () => {
    saveNotifyRecord("req-1", {
      requestedAt: "2026-11-15T01:00:00.000Z",
      nextAt: "2026-11-15T07:00:00.000Z",
    });
    expect(readNotifyRecord("req-1")?.nextAt).toBe("2026-11-15T07:00:00.000Z");
    expect(readNotifyRecord("req-2")).toBeNull();
    localStorage.setItem("margin-review-notify:req-3", "{oops");
    expect(readNotifyRecord("req-3")).toBeNull();
  });

  it("실패 코드마다 다음에 할 일을 알려 주고, 모르는 코드는 기본 문구", () => {
    expect(notifyFailureMessage("not_configured")).toContain("직접");
    expect(notifyFailureMessage("not_shared")).toContain("공유를 중지");
    expect(notifyFailureMessage("whatever")).toContain("다시 시도");
  });
});
