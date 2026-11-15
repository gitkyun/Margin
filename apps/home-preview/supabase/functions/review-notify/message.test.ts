import { describe, expect, it } from "vitest";
import {
  notifyIdempotencyKey,
  notifyWindow,
  parseNotifyInput,
  REVIEW_NOTIFY_DAILY_LIMIT,
  reviewNotifyEmail,
} from "./message";

const requestId = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("검토 알림 요청 검사", () => {
  it("상태 확인과 발송만 받고, 요청 id는 소문자로 맞춘다", () => {
    expect(parseNotifyInput('{"action":"status"}')).toEqual({
      action: "status",
    });
    expect(
      parseNotifyInput(
        JSON.stringify({ action: "send", requestId: requestId.toUpperCase() }),
      ),
    ).toEqual({ action: "send", requestId });
  });

  it("받는 주소를 본문으로 넘겨도 쓰지 않고, 잘못된 값은 거절한다", () => {
    expect(
      parseNotifyInput(
        JSON.stringify({ action: "send", requestId, to: "x@example.com" }),
      ),
    ).toEqual({ action: "send", requestId });
    expect(parseNotifyInput('{"action":"send","requestId":"1"}')).toBeNull();
    expect(parseNotifyInput("not json")).toBeNull();
    expect(parseNotifyInput("x".repeat(600))).toBeNull();
    expect(parseNotifyInput('{"action":"delete"}')).toBeNull();
  });
});

describe("하루 발송 구간", () => {
  it("한국 시간 하루를 3구간으로 나누고 다음 구간 시각을 돌려준다", () => {
    expect(REVIEW_NOTIFY_DAILY_LIMIT).toBe(3);
    // 2026-11-15 10:00 KST = 01:00 UTC → 두 번째 구간(08~16시)
    const morning = notifyWindow(new Date("2026-11-15T01:00:00Z"));
    expect(morning.slot).toBe("2026-11-15#1");
    expect(morning.nextAt).toBe("2026-11-15T07:00:00.000Z");
    // 2026-11-15 23:30 KST → 세 번째 구간, 다음은 다음 날 0시(KST)
    const night = notifyWindow(new Date("2026-11-15T14:30:00Z"));
    expect(night.slot).toBe("2026-11-15#2");
    expect(night.nextAt).toBe("2026-11-15T15:00:00.000Z");
  });

  it("같은 구간 안에서는 같은 키라 메일이 한 번만 간다", () => {
    const a = notifyWindow(new Date("2026-11-15T00:10:00Z"));
    const b = notifyWindow(new Date("2026-11-15T06:50:00Z"));
    expect(notifyIdempotencyKey(requestId, a.slot)).toBe(
      notifyIdempotencyKey(requestId, b.slot),
    );
    const c = notifyWindow(new Date("2026-11-15T07:00:00Z"));
    expect(c.slot).not.toBe(a.slot);
  });
});

describe("검토 알림 메일", () => {
  it("제목과 링크만 담고 HTML을 이스케이프한다", () => {
    const mail = reviewNotifyEmail({
      title: '<b>표 2</b> "수정"\n결과',
      link: "https://margin-research.pages.dev/reviews/abc?x=1&y=2",
    });
    expect(mail.subject).toBe("[Margin] 검토 요청이 있어요");
    expect(mail.html).not.toContain("<b>표 2</b>");
    expect(mail.html).toContain("&lt;b&gt;표 2&lt;/b&gt;");
    expect(mail.html).toContain("reviews/abc?x=1&amp;y=2");
    expect(mail.text).toContain(
      "https://margin-research.pages.dev/reviews/abc?x=1&y=2",
    );
    // 줄바꿈은 한 줄로 펴서 제목 칸이 깨지지 않게 해요.
    expect(mail.text).toContain('<b>표 2</b> "수정" 결과');
  });

  it("제목이 비면 기본 이름을 쓴다", () => {
    expect(
      reviewNotifyEmail({ title: "  ", link: "https://a.b/r" }).text,
    ).toContain("검토 요청");
  });
});
