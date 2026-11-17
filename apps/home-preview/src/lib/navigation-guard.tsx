import { t } from "@/lib/i18n";
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
  DialogBody,
  DialogFooter,
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
        t(
          "작성한 내용을 버리지 못했어요. 내용은 그대로 있으니 다시 시도해 주세요.",
        ),
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
                ? t("아직 저장하는 중이에요")
                : t("저장하지 않고 이동할까요?")}
            </DialogTitle>
            <DialogDescription>
              {summary.busy
                ? t("저장이 끝난 뒤에 이동할 수 있어요.")
                : t("저장하지 않은 내용은 사라져요.")}
            </DialogDescription>
          </DialogHeader>
          {(summary.labels.length > 0 || discardError) && (
            <DialogBody>
              {summary.labels.length > 0 && <p>{summary.labels.join(" · ")}</p>}
              {discardError && (
                <p role="alert" className="form-error">
                  {discardError}
                </p>
              )}
            </DialogBody>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (blocker.state === "blocked") blocker.reset();
              }}
            >
              {t("계속 편집")}
            </Button>
            {!summary.busy && (
              <Button
                type="button"
                variant="destructive"
                onClick={discardAndLeave}
              >
                {t("버리고 이동")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GuardContext.Provider>
  );
}

export function useNavigationGuard(options: NavigationGuardState) {
  const context = useContext(GuardContext);
  if (!context) throw new Error("NavigationGuardProvider 안에서 사용하세요."); // i18n-ignore
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
