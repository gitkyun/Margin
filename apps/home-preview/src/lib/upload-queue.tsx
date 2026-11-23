import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  recordBase,
  uid,
  type Material,
  type MaterialVersion,
} from "@/lib/domain";
import { t } from "@/lib/i18n";
import {
  uploadFile,
  validatePDF,
  validatePDFHeader,
} from "@/lib/repository";
import { friendlyError } from "@/lib/supabase";
import { useWorkspace } from "@/lib/workspace";

export type CaptureMode = "instant" | "review";

export type UploadJobStatus =
  | "queued"
  | "uploading"
  | "registering"
  | "done"
  | "failed_upload"
  | "failed_register"
  | "cancelled";

export interface UploadJobInput {
  file: File;
  researchId: string;
  title: string;
  type: Material["type"];
  typeExplicit: boolean;
  folderId?: string;
  visibility: "private" | "shared";
  /** 기존 자료에 새 버전으로 추가할 때 지정 */
  targetMaterialId?: string;
}

export interface UploadJob extends UploadJobInput {
  id: string;
  materialId: string;
  status: UploadJobStatus;
  progress: number;
  error?: string;
  /** R2(또는 preview IDB) 저장은 끝났으나 DB 등록에 실패했을 때 재업로드 없이 복구하기 위한 상태 */
  uploadedVersion?: MaterialVersion;
  savedMaterial?: Material;
  completedMaterialId?: string;
  completedVersion?: MaterialVersion;
  createdAt: number;
}

export interface StagedUploadFile {
  id: string;
  file: File;
  researchId: string;
  title: string;
  type: Material["type"];
  typeExplicit: boolean;
  folderId?: string;
  visibility: "private" | "shared";
  targetMaterialId?: string;
}

export interface DuplicateCandidate {
  id: string;
  file: File;
  researchId: string;
  folderId?: string;
  existingMaterial: Material;
  existingVersion: MaterialVersion;
}

export type DuplicateResolutionAction = "new_version" | "keep_existing" | "new_material";

export interface EnqueueOptions {
  researchId: string;
  folderId?: string;
  forceReview?: boolean;
  visibility?: "private" | "shared";
}

export interface UploadQueueContextValue {
  captureMode: CaptureMode;
  setCaptureMode(mode: CaptureMode): void;
  jobs: UploadJob[];
  stagedFiles: StagedUploadFile[];
  duplicates: DuplicateCandidate[];
  collapsed: boolean;
  setCollapsed(next: boolean): void;
  recentUploadedByResearch: Record<string, string[]>;
  enqueueCapture(files: File[], options: EnqueueOptions): void;
  confirmStaged(edited: StagedUploadFile[]): void;
  cancelStaged(): void;
  resolveDuplicate(
    candidateId: string,
    action: DuplicateResolutionAction,
  ): void;
  cancelJob(jobId: string): void;
  retryJob(jobId: string): void;
  retryAllFailed(): void;
  dismissCompleted(): void;
  clearTray(): void;
  dismissRecent(researchId: string): void;
}

const MAX_CONCURRENCY = 2;
const CAPTURE_MODE_KEY = "margin-upload-capture-mode";

export function cleanFileTitle(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_]+/g, " ")
    .trim()
    .slice(0, 200) || fileName;
}

export function findDuplicateCandidates(
  files: File[],
  researchId: string,
  materials: readonly Material[],
  versions: readonly MaterialVersion[],
  folderId?: string,
): { unique: File[]; duplicates: DuplicateCandidate[] } {
  const activeMaterials = new Map(
    materials
      .filter((m) => m.researchId === researchId && !m.archivedAt && !m.externalUrl)
      .map((m) => [m.id, m]),
  );
  const researchVersions = versions
    .filter((v) => v.researchId === researchId && !v.archivedAt && activeMaterials.has(v.materialId))
    .sort((a, b) => b.number - a.number);

  const unique: File[] = [];
  const duplicates: DuplicateCandidate[] = [];

  for (const file of files) {
    const match = researchVersions.find(
      (v) =>
        v.fileName.toLowerCase() === file.name.toLowerCase() &&
        v.size === file.size,
    );
    if (match) {
      const mat = activeMaterials.get(match.materialId)!;
      duplicates.push({
        id: uid(),
        file,
        researchId,
        folderId,
        existingMaterial: mat,
        existingVersion: match,
      });
    } else {
      unique.push(file);
    }
  }
  return { unique, duplicates };
}

function makeStaged(
  file: File,
  researchId: string,
  folderId?: string,
  visibility: "private" | "shared" = "private",
  targetMaterialId?: string,
): StagedUploadFile {
  return {
    id: uid(),
    file,
    researchId,
    title: cleanFileTitle(file.name),
    type: "other",
    typeExplicit: false,
    folderId,
    visibility,
    targetMaterialId,
  };
}

function makeJob(input: UploadJobInput): UploadJob {
  return {
    ...input,
    id: uid(),
    materialId: input.targetMaterialId ?? uid(),
    status: "queued",
    progress: 0,
    createdAt: Date.now(),
  };
}

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const { data, user, mode, save, refresh } = useWorkspace();
  const [captureMode, setCaptureModeState] = useState<CaptureMode>(() => {
    try {
      const stored = localStorage.getItem(CAPTURE_MODE_KEY);
      return stored === "review" ? "review" : "instant";
    } catch {
      return "instant";
    }
  });
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StagedUploadFile[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [recentUploadedByResearch, setRecentUploadedByResearch] = useState<
    Record<string, string[]>
  >({});

  const jobsRef = useRef<UploadJob[]>(jobs);
  jobsRef.current = jobs;
  const dataRef = useRef(data);
  dataRef.current = data;
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
  const refreshTimerRef = useRef<number | null>(null);
  const pendingReviewAfterDupRef = useRef(false);

  const setCaptureMode = useCallback((next: CaptureMode) => {
    setCaptureModeState(next);
    try {
      localStorage.setItem(CAPTURE_MODE_KEY, next);
    } catch {}
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refresh();
    }, 250);
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
      for (const ctrl of controllersRef.current.values()) {
        ctrl.abort();
      }
    };
  }, []);

  const patchJob = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    );
  }, []);

  const markRecent = useCallback((researchId: string, materialId: string) => {
    setRecentUploadedByResearch((prev) => {
      const existing = prev[researchId] ?? [];
      if (existing.includes(materialId)) return prev;
      return { ...prev, [researchId]: [materialId, ...existing] };
    });
  }, []);

  const runJob = useCallback(
    async (job: UploadJob) => {
      const controller = new AbortController();
      controllersRef.current.set(job.id, controller);

      let uploadedVersion = job.uploadedVersion;
      let savedMaterial = job.savedMaterial;

      try {
        // 1) R2(또는 preview IDB) 파일 전송 — 이미 올라간 버전이 있으면 재업로드하지 않음
        if (!uploadedVersion) {
          patchJob(job.id, {
            status: "uploading",
            progress: 0,
            error: undefined,
          });
          await validatePDFHeader(job.file);

          const draftForPath: Material = {
            ...recordBase(job.researchId),
            id: job.materialId,
            title: job.title.trim() || cleanFileTitle(job.file.name),
            type: job.type,
            typeExplicit: job.typeExplicit,
            folderId: job.folderId,
            visibility: job.visibility,
          };

          uploadedVersion = await uploadFile(
            job.file,
            draftForPath,
            user.id,
            mode,
            (pct) => patchJob(job.id, { progress: pct }),
            controller.signal,
          );
          patchJob(job.id, { uploadedVersion, progress: 100 });
        }

        // 2) DB 등록 (Material → MaterialVersion). 실패 시 uploadedVersion을 유지해 재업로드 없이 복구
        patchJob(job.id, { status: "registering", error: undefined });

        if (!savedMaterial) {
          if (job.targetMaterialId) {
            const existing = dataRef.current.materials.find(
              (m) => m.id === job.targetMaterialId,
            );
            if (!existing) {
              throw new Error(t("버전을 추가할 기존 자료를 찾을 수 없어요."));
            }
            savedMaterial = existing;
          } else {
            const materialPayload: Material = {
              ...recordBase(job.researchId),
              id: job.materialId,
              title: job.title.trim() || cleanFileTitle(job.file.name),
              type: job.type,
              typeExplicit: job.typeExplicit,
              folderId: job.folderId,
              visibility: job.visibility,
            };
            savedMaterial = await save("materials", materialPayload, {
              skipRefresh: true,
            });
          }
          patchJob(job.id, { savedMaterial });
        }

        const nextNumber =
          (dataRef.current.versions
            .filter((v) => v.materialId === savedMaterial!.id)
            .reduce((max, v) => Math.max(max, v.number), 0) ?? 0) + 1;

        const savedVersion = await save(
          "versions",
          {
            ...uploadedVersion,
            materialId: savedMaterial.id,
            number: nextNumber,
          },
          { skipRefresh: true },
        );

        patchJob(job.id, {
          status: "done",
          progress: 100,
          completedMaterialId: savedMaterial.id,
          completedVersion: savedVersion,
          error: undefined,
        });
        markRecent(job.researchId, savedMaterial.id);
        scheduleRefresh();
      } catch (error) {
        if (controller.signal.aborted) {
          patchJob(job.id, { status: "cancelled", error: undefined });
        } else if (uploadedVersion) {
          // 파일은 저장됐지만 DB 등록 실패 → 재업로드 없이 등록만 재시도 가능
          patchJob(job.id, {
            status: "failed_register",
            uploadedVersion,
            savedMaterial,
            error:
              error instanceof Error
                ? friendlyError(error)
                : t("파일은 올렸지만 자료에 등록하지 못했어요."),
          });
          setCollapsed(false);
        } else {
          patchJob(job.id, {
            status: "failed_upload",
            error:
              error instanceof Error
                ? friendlyError(error)
                : t("파일을 올리지 못했어요. 다시 시도해 주세요."),
          });
          setCollapsed(false);
        }
      } finally {
        controllersRef.current.delete(job.id);
      }
    },
    [mode, user.id, save, patchJob, markRecent, scheduleRefresh],
  );

  // 동시성 제한(MAX_CONCURRENCY = 2) 스케줄러
  useEffect(() => {
    const activeCount = jobs.filter(
      (j) => j.status === "uploading" || j.status === "registering",
    ).length;
    const slots = Math.max(0, MAX_CONCURRENCY - activeCount);
    if (slots === 0) return;
    const nextJobs = jobs.filter((j) => j.status === "queued").slice(0, slots);
    for (const job of nextJobs) {
      // 동기적으로 먼저 상태 전환해 중복 스케줄 방지
      patchJob(job.id, { status: "uploading" });
      void runJob(job);
    }
  }, [jobs, patchJob, runJob]);

  const startItems = useCallback(
    (items: StagedUploadFile[], shouldReview: boolean) => {
      if (!items.length) return;
      if (shouldReview) {
        setStagedFiles((prev) => [...prev, ...items]);
        return;
      }
      const nextJobs = items.map((item) => makeJob(item));
      setJobs((prev) => [...nextJobs, ...prev]);
    },
    [],
  );

  const enqueueCapture = useCallback(
    (files: File[], options: EnqueueOptions) => {
      if (!files.length) return;
      const valid: File[] = [];
      const errors: string[] = [];
      for (const file of files) {
        try {
          validatePDF(file);
          valid.push(file);
        } catch (err) {
          errors.push(
            `${file.name}: ${err instanceof Error ? err.message : t("PDF 파일을 선택해 주세요.")}`,
          );
        }
      }
      if (errors.length) {
        toast.error(
          errors.length === 1
            ? errors[0]
            : t("{count}개 파일은 PDF 형식이 아니거나 500MB를 넘어 제외했어요.", {
                count: errors.length,
              }),
        );
      }
      if (!valid.length) return;

      const shouldReview = options.forceReview ?? captureMode === "review";
      const visibility = options.visibility ?? "private";
      const { unique, duplicates: foundDups } = findDuplicateCandidates(
        valid,
        options.researchId,
        dataRef.current.materials,
        dataRef.current.versions,
        options.folderId,
      );

      if (unique.length) {
        startItems(
          unique.map((f) =>
            makeStaged(f, options.researchId, options.folderId, visibility),
          ),
          shouldReview,
        );
      }
      if (foundDups.length) {
        pendingReviewAfterDupRef.current = shouldReview;
        setDuplicates((prev) => [...prev, ...foundDups]);
      }
    },
    [captureMode, startItems],
  );

  const confirmStaged = useCallback((edited: StagedUploadFile[]) => {
    setStagedFiles([]);
    if (!edited.length) return;
    const nextJobs = edited.map((item) => makeJob(item));
    setJobs((prev) => [...nextJobs, ...prev]);
  }, []);

  const cancelStaged = useCallback(() => {
    setStagedFiles([]);
  }, []);

  const resolveDuplicate = useCallback(
    (candidateId: string, action: DuplicateResolutionAction) => {
      const target = duplicates.find((d) => d.id === candidateId);
      setDuplicates((prev) => prev.filter((d) => d.id !== candidateId));
      if (!target) return;

      if (action === "keep_existing") {
        toast.info(
          t("기존 자료 ‘{title}’을 그대로 유지했어요.", {
            title: target.existingMaterial.title,
          }),
        );
        return;
      }

      if (action === "new_version") {
        const staged = makeStaged(
          target.file,
          target.researchId,
          target.existingMaterial.folderId,
          target.existingMaterial.visibility ?? "private",
          target.existingMaterial.id,
        );
        staged.title = target.existingMaterial.title;
        staged.type = target.existingMaterial.type;
        staged.typeExplicit = !!target.existingMaterial.typeExplicit;
        startItems([staged], false);
        return;
      }

      // 별도 자료로 새로 추가
      const staged = makeStaged(
        target.file,
        target.researchId,
        target.folderId,
        "private",
      );
      startItems([staged], pendingReviewAfterDupRef.current);
    },
    [duplicates, startItems],
  );

  const cancelJob = useCallback((jobId: string) => {
    const ctrl = controllersRef.current.get(jobId);
    if (ctrl) ctrl.abort();
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId &&
        (j.status === "queued" || j.status === "uploading")
          ? { ...j, status: "cancelled" }
          : j,
      ),
    );
  }, []);

  const retryJob = useCallback((jobId: string) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId &&
        (j.status === "failed_upload" || j.status === "failed_register")
          ? { ...j, status: "queued", error: undefined }
          : j,
      ),
    );
  }, []);

  const retryAllFailed = useCallback(() => {
    setJobs((prev) =>
      prev.map((j) =>
        j.status === "failed_upload" || j.status === "failed_register"
          ? { ...j, status: "queued", error: undefined }
          : j,
      ),
    );
  }, []);

  const dismissCompleted = useCallback(() => {
    setJobs((prev) =>
      prev.filter((j) => j.status !== "done" && j.status !== "cancelled"),
    );
  }, []);

  const clearTray = useCallback(() => {
    setJobs((prev) =>
      prev.filter(
        (j) =>
          j.status === "queued" ||
          j.status === "uploading" ||
          j.status === "registering",
      ),
    );
  }, []);

  const dismissRecent = useCallback((researchId: string) => {
    setRecentUploadedByResearch((prev) => {
      if (!prev[researchId]?.length) return prev;
      const next = { ...prev };
      delete next[researchId];
      return next;
    });
  }, []);

  const value = useMemo<UploadQueueContextValue>(
    () => ({
      captureMode,
      setCaptureMode,
      jobs,
      stagedFiles,
      duplicates,
      collapsed,
      setCollapsed,
      recentUploadedByResearch,
      enqueueCapture,
      confirmStaged,
      cancelStaged,
      resolveDuplicate,
      cancelJob,
      retryJob,
      retryAllFailed,
      dismissCompleted,
      clearTray,
      dismissRecent,
    }),
    [
      captureMode,
      setCaptureMode,
      jobs,
      stagedFiles,
      duplicates,
      collapsed,
      recentUploadedByResearch,
      enqueueCapture,
      confirmStaged,
      cancelStaged,
      resolveDuplicate,
      cancelJob,
      retryJob,
      retryAllFailed,
      dismissCompleted,
      clearTray,
      dismissRecent,
    ],
  );

  return (
    <UploadQueueContext.Provider value={value}>
      {children}
    </UploadQueueContext.Provider>
  );
}

export function useUploadQueue() {
  const ctx = useContext(UploadQueueContext);
  if (!ctx) {
    throw new Error("UploadQueueProvider 안에서만 사용할 수 있어요.");
  }
  return ctx;
}
