import type { AIInput } from "@/lib/domain";

export interface AISource {
  text: string;
  revision?: number;
}

// Candidates belong to the exact source the AI read. The server rejects a
// quote whose memo revision moved on, so treat any later edit as stale.
export function isAISourceStale(input: AIInput, current: AISource): boolean {
  if (input.sourceText !== current.text) return true;
  return (
    input.sourceRevision !== undefined &&
    input.sourceRevision !== current.revision
  );
}
