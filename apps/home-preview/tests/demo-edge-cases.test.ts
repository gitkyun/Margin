import { describe, expect, it } from "vitest";
import { buildDemo } from "../src/lib/demo";

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

describe("미리보기 데이터 예외 사례", () => {
  const data = buildDemo();
  const hasRecording = (id: string) =>
    (data.recordings ?? []).some(
      (r: { meetingId?: string }) => r.meetingId === id,
    );

  it("메모·녹음이 없는 지난 미팅이 있어요", () => {
    expect(
      data.meetings.some(
        (m) =>
          m.date && m.date < today && !m.memo.trim() && !hasRecording(m.id),
      ),
    ).toBe(true);
  });
  it("날짜 미정 미팅이 있어요", () => {
    expect(
      data.meetings.some((m) => m.date === null && m.status === "preparing"),
    ).toBe(true);
  });
  it("90자 이상 긴 제목이 있어요", () => {
    const titles = [...data.feedback, ...data.tasks].map((x) => x.title);
    expect(titles.some((t) => t.length >= 90 && t.length <= 120)).toBe(true);
  });
  it("모호한 메모 문장이 있어요", () => {
    expect(
      data.meetings.some((m) => m.memo.includes("다음 학기에 다시 보죠")),
    ).toBe(true);
  });
  it("보류·고치지 않음 피드백이 있어요", () => {
    const statuses = data.feedback.map((f) => f.status);
    expect(statuses).toContain("held");
    expect(statuses).toContain("unchanged");
  });
  it("마감이 지난 할 일이 있어요", () => {
    expect(
      data.tasks.some(
        (t) => t.status !== "done" && t.dueDate && t.dueDate < today,
      ),
    ).toBe(true);
  });
  it("기존 검토 차수가 처음 두 피드백을 그대로 써요", () => {
    expect(data.rounds[0].feedbackExcerpt).toBe(data.feedback[0].body);
    expect(data.rounds[1].feedbackExcerpt).toBe(data.feedback[1].body);
  });
});
