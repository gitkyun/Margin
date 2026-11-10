import { describe, expect, it } from "vitest";
import {
  MAX_ADVISORS,
  addAdvisor,
  advisorChoices,
  parseAdvisorEmails,
} from "./advisors";

describe("parseAdvisorEmails", () => {
  it("splits on commas, spaces and new lines, lowercases and removes duplicates", () => {
    expect(
      parseAdvisorEmails("Kim@Univ.ac.kr, lee@univ.ac.kr\nkim@univ.ac.kr"),
    ).toEqual(["kim@univ.ac.kr", "lee@univ.ac.kr"]);
  });

  it("drops text that is not an email", () => {
    expect(parseAdvisorEmails("김교수, kim@univ")).toEqual([]);
  });

  it("keeps at most the allowed number", () => {
    const many = Array.from({ length: 8 }, (_, i) => `p${i}@univ.ac.kr`);
    expect(parseAdvisorEmails(many.join(" "))).toHaveLength(MAX_ADVISORS);
  });
});

describe("addAdvisor", () => {
  it("adds a new email without changing the original list", () => {
    const current = ["kim@univ.ac.kr"];
    expect(addAdvisor(current, " Lee@univ.ac.kr ")).toEqual([
      "kim@univ.ac.kr",
      "lee@univ.ac.kr",
    ]);
    expect(current).toEqual(["kim@univ.ac.kr"]);
  });

  it("returns the same list for a duplicate or an invalid email", () => {
    const current = ["kim@univ.ac.kr"];
    expect(addAdvisor(current, "KIM@univ.ac.kr")).toBe(current);
    expect(addAdvisor(current, "not-an-email")).toBe(current);
  });
});

describe("advisorChoices", () => {
  it("lists registered advisors first, then previously used emails once", () => {
    expect(
      advisorChoices(["kim@univ.ac.kr"], ["lee@univ.ac.kr", "kim@univ.ac.kr"]),
    ).toEqual(["kim@univ.ac.kr", "lee@univ.ac.kr"]);
  });

  it("works when nothing is registered yet", () => {
    expect(advisorChoices(undefined, ["lee@univ.ac.kr"])).toEqual([
      "lee@univ.ac.kr",
    ]);
  });
});
