export interface MemoDraft {
  text: string;
  baseMemo: string | null;
  baseRevision: number | null;
}

export function restoreMemoDraft(raw: string | null): MemoDraft | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "text" in value &&
      typeof value.text === "string"
    ) {
      const draft = value as Partial<MemoDraft>;
      return {
        text: value.text,
        baseMemo: typeof draft.baseMemo === "string" ? draft.baseMemo : null,
        baseRevision:
          typeof draft.baseRevision === "number" ? draft.baseRevision : null,
      };
    }
  } catch {
    /* Older drafts stored the text directly. Their original baseline is unknown. */
  }
  return { text: raw, baseMemo: null, baseRevision: null };
}

export function hasMemoConflict(baseMemo: string | null, currentMemo: string) {
  return baseMemo === null || baseMemo !== currentMemo;
}
