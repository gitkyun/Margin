import type { ResearchPhase } from "./domain";

/** 서버의 정수 순서 계약을 지키고 바뀐 단계만 저장합니다. */
export function phaseOrderChanges(
  phases: ResearchPhase[],
  keys: string[],
): ResearchPhase[] {
  if (
    keys.length !== phases.length ||
    new Set(keys).size !== keys.length ||
    keys.some((key) => !phases.some((phase) => phase.id === key))
  ) {
    throw new Error("Invalid phase order");
  }
  return keys.flatMap((key, order) => {
    const phase = phases.find((item) => item.id === key)!;
    return phase.order === order ? [] : [{ ...phase, order }];
  });
}

/** 중간 저장이 실패하면 이 요청이 저장한 버전만 되돌립니다. */
export async function savePhaseOrder(
  phases: ResearchPhase[],
  keys: string[],
  save: (phase: ResearchPhase) => Promise<ResearchPhase>,
) {
  const saved: ResearchPhase[] = [];
  try {
    for (const phase of phaseOrderChanges(phases, keys))
      saved.push(await save(phase));
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const after of saved.reverse()) {
      const before = phases.find((phase) => phase.id === after.id)!;
      try {
        await save({ ...after, order: before.order });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    if (rollbackErrors.length)
      throw new AggregateError(
        [error, ...rollbackErrors],
        "Phase order could not be restored",
      );
    throw error;
  }
}
