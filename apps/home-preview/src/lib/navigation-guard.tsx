import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useBlocker } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface NavigationGuardState {
  dirty: boolean;
  busy?: boolean;
  label?: string;
  onDiscard?(): void;
}
interface GuardEntry {
  current: NavigationGuardState;
}
interface GuardContextValue {
  register(id: string, entry: GuardEntry): () => void;
  changed(): void;
}
const GuardContext = createContext<GuardContextValue | null>(null);

export function navigationGuardSummary(guards: NavigationGuardState[]) {
  const active = guards.filter((guard) => guard.dirty || guard.busy);
  return {
    active: active.length > 0,
    busy: active.some((guard) => guard.busy),
    labels: [...new Set(active.map((guard) => guard.label).filter(Boolean))],
  };
}

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const entries = useRef(new Map<string, GuardEntry>());
  const [revision, setRevision] = useState(0);
  const [discardError, setDiscardError] = useState("");
  const changed = useCallback(() => setRevision((value) => value + 1), []);
  const register = useCallback(
    (id: string, entry: GuardEntry) => {
      entries.current.set(id, entry);
      changed();
      return () => {
        entries.current.delete(id);
        changed();
      };
    },
    [changed],
  );
  const currentGuards = () =>
    [...entries.current.values()].map((entry) => entry.current);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const targetChanges =
      currentLocation.pathname !== nextLocation.pathname ||
      currentLocation.search !== nextLocation.search ||
      currentLocation.hash !== nextLocation.hash;
    return targetChanges && navigationGuardSummary(currentGuards()).active;
  });
  const summary = navigationGuardSummary(currentGuards());

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!navigationGuardSummary(currentGuards()).active) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    // A successful save may close a dialog and navigate in the same event.
    // Once the latest registrations are clear, continue that blocked transition.
    if (
      blocker.state === "blocked" &&
      !navigationGuardSummary(currentGuards()).active
    )
      blocker.proceed();
    if (blocker.state === "unblocked") setDiscardError("");
  }, [blocker, revision]);

  function discardAndLeave() {
    if (
      blocker.state !== "blocked" ||
      navigationGuardSummary(currentGuards()).busy
    )
      return;
    try {
      for (const entry of entries.current.values()) {
        if (entry.current.dirty) entry.current.onDiscard?.();
      }
      for (const entry of entries.current.values()) {
        entry.current = { ...entry.current, dirty: false, busy: false };
      }
      changed();
      blocker.proceed();
    } catch {
      setDiscardError(
        "작성 내용을 정리하지 못했습니다. 계속 편집한 뒤 다시 이동해 주세요.",
      );
    }
  }

  return (
    <GuardContext.Provider value={{ register, changed }}>
      {children}
      <Dialog
        open={blocker.state === "blocked"}
        onOpenChange={(open: boolean) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>
              {summary.busy
                ? "저장하는 동안 잠시 기다려 주세요."
                : "저장하지 않은 내용이 있습니다."}
            </DialogTitle>
            <DialogDescription>
              {summary.busy
                ? "저장이 끝나기 전에는 이동할 수 없습니다. 이 화면에서 계속 편집할 수 있습니다."
                : "계속 편집하거나 작성한 내용을 버리고 이동할 수 있습니다."}
            </DialogDescription>
          </DialogHeader>
          {summary.labels.length > 0 && <p>{summary.labels.join(" · ")}</p>}
          {discardError && (
            <p role="alert" className="form-error">
              {discardError}
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (blocker.state === "blocked") blocker.reset();
              }}
            >
              계속 편집
            </Button>
            {!summary.busy && (
              <Button
                type="button"
                variant="destructive"
                onClick={discardAndLeave}
              >
                버리고 이동
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </GuardContext.Provider>
  );
}

export function useNavigationGuard(options: NavigationGuardState) {
  const context = useContext(GuardContext);
  if (!context) throw new Error("NavigationGuardProvider 안에서 사용하세요.");
  const id = useId();
  const entry = useRef<NavigationGuardState>(options);
  entry.current = options;
  const { register, changed } = context;
  useEffect(() => register(id, entry), [id, register]);
  useEffect(
    () => changed(),
    [changed, options.dirty, options.busy, options.label],
  );
  const clear = useCallback(() => {
    entry.current = { ...entry.current, dirty: false, busy: false };
    changed();
  }, [changed]);
  return { clear };
}
