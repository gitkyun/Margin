import { describe, expect, it } from "vitest";
import { parseFolded } from "../src/components/meetings/RecordSide";

describe("parseFolded", () => {
  it("reads a saved map of section → open", () => {
    expect(parseFolded('{"summary":false,"tasks":true}')).toEqual({
      summary: false,
      tasks: true,
    });
  });
  it.each([null, "null", "3", '"x"', "[true]", "{bad json"])(
    "falls back to an empty map for %s",
    (raw) => {
      expect(parseFolded(raw)).toEqual({});
    },
  );
  it("drops values that are not true/false", () => {
    expect(parseFolded('{"a":true,"b":"yes"}')).toEqual({ a: true });
  });
});
