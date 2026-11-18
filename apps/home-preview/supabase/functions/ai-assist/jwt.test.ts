import { expect, it } from "vitest";
import { unverifiedSubject } from "./jwt";

const encode = (value: object) =>
  btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const id = "0f8fad5b-d9cb-469f-a165-70867728950e";

it("토큰의 sub를 꺼낸다", () => {
  expect(
    unverifiedSubject(
      `Bearer ${encode({ alg: "HS256" })}.${encode({ sub: id })}.sig`,
    ),
  ).toBe(id);
});
it("형식이 틀리거나 sub가 id가 아니면 비워 둔다", () => {
  expect(unverifiedSubject("Bearer nope")).toBeUndefined();
  expect(
    unverifiedSubject(`Bearer x.${encode({ sub: "anon" })}.y`),
  ).toBeUndefined();
});
