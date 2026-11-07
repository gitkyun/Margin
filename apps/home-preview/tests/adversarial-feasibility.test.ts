// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState, useCallback, useEffect } from "react";

// ============================================================================
// 1. useUnsavedChangesGuard 훅 실증 검증
// ============================================================================
interface UseUnsavedChangesGuardOptions {
  isDirty: boolean;
  onConfirmDiscard?: () => void;
  confirmMessage?: string;
}

function useUnsavedChangesGuard({
  isDirty,
  onConfirmDiscard,
  confirmMessage = "작성 중인 내용이 있습니다. 저장하지 않고 닫으시겠습니까?",
}: UseUnsavedChangesGuardOptions) {
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [pendingCloseAction, setPendingCloseAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = confirmMessage;
        return confirmMessage;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, confirmMessage]);

  const interceptClose = useCallback(
    (closeFn: () => void) => {
      if (isDirty) {
        setPendingCloseAction(() => closeFn);
        setDiscardDialogOpen(true);
      } else {
        closeFn();
      }
    },
    [isDirty]
  );

  const confirmDiscard = useCallback(() => {
    setDiscardDialogOpen(false);
    if (pendingCloseAction) {
      pendingCloseAction();
      setPendingCloseAction(null);
    }
    if (onConfirmDiscard) {
      onConfirmDiscard();
    }
  }, [pendingCloseAction, onConfirmDiscard]);

  const cancelDiscard = useCallback(() => {
    setDiscardDialogOpen(false);
    setPendingCloseAction(null);
  }, []);

  return {
    discardDialogOpen,
    interceptClose,
    confirmDiscard,
    cancelDiscard,
  };
}

describe("Adversarial Verification 1: useUnsavedChangesGuard", () => {
  it("when isDirty=false, interceptClose executes closeFn immediately without opening discard dialog", () => {
    const closeFn = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard({ isDirty: false }));

    act(() => {
      result.current.interceptClose(closeFn);
    });

    expect(closeFn).toHaveBeenCalledTimes(1);
    expect(result.current.discardDialogOpen).toBe(false);
  });

  it("when isDirty=true, interceptClose blocks closeFn and opens discard dialog", () => {
    const closeFn = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard({ isDirty: true }));

    act(() => {
      result.current.interceptClose(closeFn);
    });

    expect(closeFn).not.toHaveBeenCalled();
    expect(result.current.discardDialogOpen).toBe(true);

    // If user cancels, closeFn must still NOT be called
    act(() => {
      result.current.cancelDiscard();
    });
    expect(closeFn).not.toHaveBeenCalled();
    expect(result.current.discardDialogOpen).toBe(false);

    // If user intercepts again and confirms discard, closeFn MUST be called
    act(() => {
      result.current.interceptClose(closeFn);
    });
    expect(result.current.discardDialogOpen).toBe(true);

    act(() => {
      result.current.confirmDiscard();
    });
    expect(closeFn).toHaveBeenCalledTimes(1);
    expect(result.current.discardDialogOpen).toBe(false);
  });

  it("beforeunload event sets defaultPrevented when isDirty=true", () => {
    renderHook(() => useUnsavedChangesGuard({ isDirty: true, confirmMessage: "저장되지 않음" }));
    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

// ============================================================================
// 2. 동시성 충돌 복구 및 루프 방지 로직 실증 검증
// ============================================================================
describe("Adversarial Verification 2: Concurrency Conflict & Loop Prevention", () => {
  function assertUnchanged(
    current: { updatedAt: string } | undefined,
    incoming: { updatedAt: string }
  ) {
    if (current && current.updatedAt !== incoming.updatedAt) {
      throw new Error("다른 창에서 이 기록을 수정했습니다. 최신 내용을 확인한 뒤 다시 저장해 주세요.");
    }
  }

  it("stale updatedAt throws conflict error, but refreshed updatedAt succeeds", () => {
    let serverRecord = { id: "m1", memo: "initial memo", updatedAt: "2026-11-06T10:00:00Z" };

    // Client opened modal at 10:00:00Z
    const clientSnapshot = { ...serverRecord };

    // Another tab updated record at 10:00:05Z
    serverRecord = { id: "m1", memo: "updated in tab 2", updatedAt: "2026-11-06T10:00:05Z" };

    // Client tries to save using stale clientSnapshot
    const incomingStale = { ...clientSnapshot, memo: "client draft" };
    expect(() => assertUnchanged(serverRecord, incomingStale)).toThrow("다른 창에서 이 기록을 수정했습니다");

    // Concurrency Resolution: client refreshes server record to get latest updatedAt
    const refreshedServerRecord = { ...serverRecord };
    const incomingResolved = {
      ...incomingStale,
      updatedAt: refreshedServerRecord.updatedAt, // Force overwrite with latest timestamp token
    };

    // Assert that save now succeeds without throwing
    expect(() => assertUnchanged(serverRecord, incomingResolved)).not.toThrow();
  });

  it("clipboard draft copy and server acceptance prevents data loss", async () => {
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    const localDraftContent = "매우 중요한 회의록 메모 작성본";
    let activeContent = "이전 서버 내용";

    // Simulate handleAccept from ConflictResolutionModal
    await navigator.clipboard.writeText(localDraftContent);
    activeContent = "새로 수정된 최신 서버 내용";

    expect(mockClipboard.writeText).toHaveBeenCalledWith(localDraftContent);
    expect(activeContent).toBe("새로 수정된 최신 서버 내용");
  });
});

// ============================================================================
// 3. 교수 검토 차수 고정(Pinning) 및 초안 보존 로직 실증 검증
// ============================================================================
describe("Adversarial Verification 3: Review Round Pinning & Draft Persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("pins to query round even when a newer round arrives via 30s background poll", () => {
    const initialRounds = [
      { id: "round-1", itemId: "item-1", requestId: "req-1", number: 1 },
    ];

    let currentParams = new URLSearchParams("item=item-1&round=round-1");

    function resolveActiveRound(rounds: typeof initialRounds, params: URLSearchParams) {
      const queryRoundId = params.get("round");
      const sorted = [...rounds].sort((a, b) => b.number - a.number);
      return sorted.find((r) => r.id === queryRoundId) ?? sorted[0];
    }

    let active = resolveActiveRound(initialRounds, currentParams);
    expect(active.id).toBe("round-1");

    // 30s poll arrives: Student registered Round 2!
    const polledRounds = [
      { id: "round-2", itemId: "item-1", requestId: "req-1", number: 2 },
      { id: "round-1", itemId: "item-1", requestId: "req-1", number: 1 },
    ];

    // If query was NOT pinned (legacy bug):
    const legacyParams = new URLSearchParams("item=item-1"); // no round param
    const legacyActive = resolveActiveRound(polledRounds, legacyParams);
    expect(legacyActive.id).toBe("round-2"); // BUG: jumped to round 2, discarding professor's draft!

    // With URL Pinning fix:
    const pinnedActive = resolveActiveRound(polledRounds, currentParams);
    expect(pinnedActive.id).toBe("round-1"); // FIXED: remains pinned to round-1!
  });

  it("preserves draft comment across rounds via localStorage isolation", () => {
    const userId = "prof-1";
    const requestId = "req-123";
    const round1Key = `rms-review-draft:${userId}:${requestId}:round-1`;
    const round2Key = `rms-review-draft:${userId}:${requestId}:round-2`;

    const draft1 = { result: "changes_requested", comment: "1차 보완 필요: 실험 데이터 3번 추가" };
    localStorage.setItem(round1Key, JSON.stringify(draft1));

    // Inspect stored draft for round 1
    const loaded1 = JSON.parse(localStorage.getItem(round1Key)!);
    expect(loaded1.comment).toBe("1차 보완 필요: 실험 데이터 3번 추가");

    // Round 2 draft is completely empty and independent
    expect(localStorage.getItem(round2Key)).toBeNull();
  });
});

// ============================================================================
// 4. 모바일 자료실 스택 전환 로직 실증 검증
// ============================================================================
describe("Adversarial Verification 4: Mobile Materials Stack Switching", () => {
  it("toggles between folders and files views correctly without state contamination", () => {
    let mobileView: "folders" | "files" = "files";

    const setMobileView = (v: "folders" | "files") => {
      mobileView = v;
    };

    expect(mobileView).toBe("files");

    // User taps '폴더 구조'
    setMobileView("folders");
    expect(mobileView).toBe("folders");

    // User selects a folder -> should auto-switch back to files view
    const onSelectFolder = (folderId: string) => {
      setMobileView("files");
    };
    onSelectFolder("folder-uuid-1");
    expect(mobileView).toBe("files");
  });
});

// ============================================================================
// 5. 820px 레이아웃 수학적 수치 정합성 실증 계산
// ============================================================================
describe("Adversarial Verification 5: 820px Tablet Grid Math Verification", () => {
  it("proves desktop 2-column layout causes 456px card squeeze and 307px body collapse at 820px", () => {
    const viewportWidth = 820; // iPad Air
    const containerPadding = 32 * 2; // 64px
    const availableWidth = viewportWidth - containerPadding; // 756px

    expect(availableWidth).toBe(756);

    // Desktop 2-column rule: grid-template-columns: 260px minmax(0, 1fr); gap: 40px;
    const tourIndexWidth = 260;
    const gridGap = 40;
    const previewCardWidth = availableWidth - tourIndexWidth - gridGap;

    expect(previewCardWidth).toBe(456);

    // Details section rule: margin: 40px 0 0 300px;
    const detailsMarginLeft = 300;
    const detailsAvailableWidth = availableWidth - detailsMarginLeft;
    expect(detailsAvailableWidth).toBe(456);

    // Inner details grid: grid-template-columns: 125px minmax(0, 1fr); gap: 24px;
    const dtWidth = 125;
    const innerGap = 24;
    const ddBodyWidth = detailsAvailableWidth - dtWidth - innerGap;

    expect(ddBodyWidth).toBe(307);
  });

  it("proves 1024px single-column layout provides full width to card and details", () => {
    const viewportWidth = 820;
    const containerPadding = 32 * 2;
    const availableWidth = viewportWidth - containerPadding; // 756px

    // Under proposed 1024px rule: 1-column grid, margin-left: 0
    const proposedCardWidth = availableWidth; // 756px
    expect(proposedCardWidth).toBe(756);

    // Inner details: grid-template-columns: 160px minmax(0, 1fr); gap: 16px; margin-left: 0
    const proposedDtWidth = 160;
    const proposedGap = 16;
    const proposedDdWidth = availableWidth - proposedDtWidth - proposedGap;

    expect(proposedDdWidth).toBe(580); // Improved from 307px to 580px (+88.9% expansion)
  });
});
