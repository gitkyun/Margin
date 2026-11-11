import { describe, expect, it } from "vitest";
import { escapeHtml, formatExpiry, inviteEmail, oneLine } from "./email";
import { appUrl } from "./origins";

const base = {
  researchName: "대학원생 협업 도구 연구",
  inviterName: "김연구",
  role: "editor" as const,
  link: "https://margin-research.pages.dev/join?token=abc_DEF-123",
  expiresAt: "2026-11-18T06:00:00Z",
};

describe("연구 초대 메일", () => {
  it("제목과 필요한 정보(연구, 초대한 사람, 역할, 버튼, 유효기간, 무시 안내)를 담는다", () => {
    const mail = inviteEmail(base);
    expect(mail.subject).toBe("[Margin] 연구 프로젝트에 초대되었습니다");
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain("Margin");
      expect(body).toContain("대학원생 협업 도구 연구");
      expect(body).toContain("김연구");
      expect(body).toContain("공동연구자");
      expect(body).toContain("초대 수락");
      expect(body).toContain(base.link);
      expect(body).toContain("2026년 11월 18일");
      expect(body).toContain("무시해도 돼요");
    }
    expect(mail.html).toContain(`href="${base.link}"`);
    expect(mail.html).toContain('lang="ko"');
    expect(mail.text).not.toMatch(/<[a-z]/i);
  });

  it("지도교수 초대는 볼 수 있는 범위를 다르게 안내한다", () => {
    const mail = inviteEmail({ ...base, role: "advisor" });
    expect(mail.text).toContain("역할: 지도교수");
    expect(mail.text).toContain("검토를 요청한 항목과 연구 방향만");
    expect(mail.text).not.toContain("공동 기록을 함께 보고 편집");
  });

  it("연구 이름과 사람 이름의 HTML을 그대로 넣지 않는다", () => {
    const mail = inviteEmail({
      ...base,
      researchName: '<img src=x onerror="alert(1)">',
      inviterName: "<b>굵게</b>\n둘째 줄",
    });
    expect(mail.html).not.toContain("<img");
    expect(mail.html).not.toContain("<b>");
    expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(mail.text).toContain("초대한 사람: <b>굵게</b> 둘째 줄");
  });

  it("이름이 비었거나 날짜가 잘못돼도 읽을 수 있는 문장을 만든다", () => {
    const mail = inviteEmail({
      ...base,
      researchName: " ",
      inviterName: "",
      expiresAt: "not-a-date",
    });
    expect(mail.text).toContain("연구: 이름 없는 연구");
    expect(mail.text).toContain("마진 사용자님이");
    expect(mail.text).toContain("7일 동안 수락할 수 있어요");
  });

  it("긴 이름은 줄이고, 유효기간은 한국 시간으로 적는다", () => {
    expect(oneLine("가".repeat(100), 80)).toHaveLength(80);
    expect(oneLine("a\r\nb\tc", 10)).toBe("a b c");
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
    // 06:00 UTC = 15:00 KST
    expect(formatExpiry("2026-11-18T06:00:00Z")).toContain("15:00");
  });
});

describe("메일에 넣는 사이트 주소", () => {
  it("APP_URL이 올바르면 그것을, 아니면 요청한 주소를 쓴다", () => {
    const origin = "https://margin-research.pages.dev";
    expect(appUrl("https://margin.example.com/", origin)).toBe(
      "https://margin.example.com",
    );
    expect(appUrl(undefined, origin)).toBe(origin);
    expect(appUrl("", origin)).toBe(origin);
    expect(appUrl("javascript:alert(1)", origin)).toBe(origin);
    expect(appUrl("https://a.example.com/path", origin)).toBe(origin);
  });
});
