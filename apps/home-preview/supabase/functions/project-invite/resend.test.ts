import { describe, expect, it, vi } from "vitest";
import { sendEmail, type OutgoingEmail } from "./resend";

const mail: OutgoingEmail = {
  from: "Margin <invite@example.com>",
  to: "guest@example.com",
  subject: "제목",
  html: "<p>본문</p>",
  text: "본문",
};
const wait = () => Promise.resolve();
const respond = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status });

describe("Resend 메일 발송", () => {
  it("키가 없으면 요청하지 않고 '준비 안 됨'으로 끝낸다", async () => {
    const fetcher = vi.fn();
    const result = await sendEmail(mail, {
      apiKey: "",
      idempotencyKey: "k",
      fetcher,
    });
    expect(result).toEqual({ ok: false, reason: "not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("성공하면 메시지 id를 돌려주고, 키는 헤더로만 보낸다", async () => {
    const fetcher = vi.fn().mockResolvedValue(respond(200, { id: "re_1" }));
    const result = await sendEmail(mail, {
      apiKey: "secret-key",
      idempotencyKey: "project-invite/1/1",
      fetcher,
      wait,
    });
    expect(result).toEqual({ ok: true, id: "re_1" });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer secret-key");
    expect(init.headers["Idempotency-Key"]).toBe("project-invite/1/1");
    const body = JSON.parse(init.body);
    expect(body).toEqual({ ...mail, to: ["guest@example.com"] });
    expect(init.body).not.toContain("secret-key");
  });

  it("발송 제한과 서버 오류는 같은 멱등 키로 다시 시도한다", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(respond(429))
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(respond(200, { id: "re_2" }));
    const result = await sendEmail(mail, {
      apiKey: "k",
      idempotencyKey: "same",
      fetcher,
      wait,
    });
    expect(result).toEqual({ ok: true, id: "re_2" });
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const [, init] of fetcher.mock.calls)
      expect(init.headers["Idempotency-Key"]).toBe("same");
  });

  it("계속 실패하면 사유 코드만 돌려준다", async () => {
    const limited = vi.fn().mockImplementation(async () => respond(429));
    expect(
      await sendEmail(mail, {
        apiKey: "k",
        idempotencyKey: "a",
        fetcher: limited,
        wait,
      }),
    ).toEqual({ ok: false, reason: "rate_limited" });
    expect(limited).toHaveBeenCalledTimes(3);
    const down = vi.fn().mockImplementation(async () => respond(503));
    expect(
      await sendEmail(mail, {
        apiKey: "k",
        idempotencyKey: "a",
        fetcher: down,
        wait,
      }),
    ).toEqual({ ok: false, reason: "unavailable" });
  });

  it("다시 해도 같은 오류(발신 도메인, 키, 주소)는 재시도하지 않는다", async () => {
    for (const [status, reason] of [
      [403, "sender_not_verified"],
      [401, "not_configured"],
      [422, "rejected"],
    ] as const) {
      const fetcher = vi
        .fn()
        .mockResolvedValue(
          respond(status, { message: "secret detail guest@example.com" }),
        );
      const result = await sendEmail(mail, {
        apiKey: "k",
        idempotencyKey: "a",
        fetcher,
        wait,
      });
      expect(result).toEqual({ ok: false, reason });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toContain("guest@example.com");
    }
  });
});
