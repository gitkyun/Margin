import { expect, it, vi } from "vitest";
import type { ResearchPhase } from "./domain";
import { phaseOrderChanges, savePhaseOrder } from "./phase-order";
const phases = ["a", "b", "c", "d"].map(
  (id, order) => ({ id, order, title: id, status: "planned" }) as ResearchPhase,
);
it.each([
  ["d", "a", "b", "c"],
  ["b", "c", "d", "a"],
  ["a", "d", "b", "c"],
  ["a", "c", "b", "d"],
])("saves integer orders for a move: %j", (...keys) => {
  const changes = phaseOrderChanges(phases, keys);
  const saved = phases
    .map((phase) => changes.find((change) => change.id === phase.id) ?? phase)
    .sort((a, b) => a.order - b.order);
  expect(saved.map((phase) => phase.id)).toEqual(keys);
  expect(
    changes.every(
      (phase) => Number.isInteger(phase.order) && phase.status === "planned",
    ),
  ).toBe(true);
});
it("does not write unchanged order or accept missing or repeated phases", () => {
  expect(phaseOrderChanges(phases, ["a", "b", "c", "d"])).toEqual([]);
  expect(() => phaseOrderChanges(phases, ["a", "b"])).toThrow();
  expect(() => phaseOrderChanges(phases, ["a", "a", "c", "d"])).toThrow();
});
it("restores the successfully saved version when the next write fails", async () => {
  const saved = { ...phases[1], order: 0, updatedAt: "after-save" };
  const save = vi
    .fn()
    .mockResolvedValueOnce(saved)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(phases[1]);
  await expect(
    savePhaseOrder(phases, ["b", "a", "c", "d"], save),
  ).rejects.toThrow("offline");
  expect(save.mock.calls[2][0]).toEqual({ ...saved, order: 1 });
});
it("reports a failed rollback instead of claiming the original order was restored", async () => {
  const save = vi
    .fn()
    .mockResolvedValueOnce({ ...phases[1], order: 0 })
    .mockRejectedValue(new Error("offline"));
  await expect(
    savePhaseOrder(phases, ["b", "a", "c", "d"], save),
  ).rejects.toBeInstanceOf(AggregateError);
});
