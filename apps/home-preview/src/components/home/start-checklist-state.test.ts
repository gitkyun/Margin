import { describe, expect, it } from "vitest";
import { checklistMotion } from "./start-checklist-state";

const items = (done: boolean[]) =>
  ["record", "feedback", "task", "material"].map((key, i) => ({
    key: key as "record",
    done: done[i],
  }));

describe("checklistMotion", () => {
  it("plays nothing on the first view", () => {
    const motion = checklistMotion(items([true, false, false, false]), null);
    expect([...motion.newlyDone]).toEqual([]);
    expect(motion.startRatio).toBe(0.25);
    expect(motion.celebrate).toBe(false);
  });

  it("draws checks only for items finished since the last view", () => {
    const motion = checklistMotion(items([true, true, false, false]), [
      "record",
    ]);
    expect([...motion.newlyDone]).toEqual(["feedback"]);
    expect(motion.startRatio).toBe(0.25);
    expect(motion.celebrate).toBe(false);
  });

  it("celebrates once when the last item is finished after being seen unfinished", () => {
    const motion = checklistMotion(items([true, true, true, true]), [
      "record",
      "feedback",
      "task",
    ]);
    expect([...motion.newlyDone]).toEqual(["material"]);
    expect(motion.celebrate).toBe(true);
  });

  it("does not celebrate again after everything was already seen", () => {
    const motion = checklistMotion(items([true, true, true, true]), [
      "record",
      "feedback",
      "task",
      "material",
    ]);
    expect(motion.celebrate).toBe(false);
    expect(motion.startRatio).toBe(1);
  });
});
