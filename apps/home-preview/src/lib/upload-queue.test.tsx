// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import {
  cleanFileTitle,
  findDuplicateCandidates,
  UploadQueueProvider,
  useUploadQueue,
  type UploadQueueContextValue,
} from "./upload-queue";
import { emptyWorkspace, type Material, type MaterialVersion } from "./domain";

const mockSave = vi.fn();
const mockRefresh = vi.fn();
const mockUploadFile = vi.fn();
const mockValidatePDFHeader = vi.fn();

const mockWorkspaceData = emptyWorkspace();

vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => ({
    data: mockWorkspaceData,
    user: { id: "user-1", email: "student@test.com", name: "김학생" },
    mode: "preview",
    save: mockSave,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/repository", async () => {
  const actual = await vi.importActual<typeof import("@/lib/repository")>(
    "@/lib/repository",
  );
  return {
    ...actual,
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
    validatePDFHeader: (...args: unknown[]) => mockValidatePDFHeader(...args),
  };
});

function makePdf(name: string, content = "%PDF-1.4 sample") {
  return new File([content], name, { type: "application/pdf" });
}

describe("upload-queue helpers", () => {
  it("cleans pdf extension and underscores from title", () => {
    expect(cleanFileTitle("Smith_2025_Academic_Workflow.pdf")).toBe(
      "Smith 2025 Academic Workflow",
    );
    expect(cleanFileTitle("paper.PDF")).toBe("paper");
  });

  it("detects duplicate candidates by fileName and size in the same research", () => {
    const mat: Material = {
      id: "m1",
      researchId: "r1",
      title: "기존 논문",
      type: "reference",
      visibility: "private",
      createdAt: "2026-11-20T00:00:00Z",
      updatedAt: "2026-11-20T00:00:00Z",
    };
    const file = makePdf("paper_a.pdf", "%PDF-1.4 exact-size");
    const ver: MaterialVersion = {
      id: "v1",
      researchId: "r1",
      materialId: "m1",
      number: 1,
      fileName: "paper_a.pdf",
      storagePath: "u/r1/v1.pdf",
      size: file.size,
      mimeType: "application/pdf",
      createdAt: "2026-11-20T00:00:00Z",
      updatedAt: "2026-11-20T00:00:00Z",
    };
    const fresh = makePdf("paper_b.pdf", "%PDF-1.4 fresh");
    const res = findDuplicateCandidates([file, fresh], "r1", [mat], [ver]);
    expect(res.duplicates).toHaveLength(1);
    expect(res.duplicates[0].existingMaterial.id).toBe("m1");
    expect(res.unique).toHaveLength(1);
    expect(res.unique[0].name).toBe("paper_b.pdf");
  });
});

describe("UploadQueueProvider", () => {
  let api!: UploadQueueContextValue;

  function Harness() {
    api = useUploadQueue();
    return null;
  }

  beforeEach(() => {
    localStorage.clear();
    mockWorkspaceData.materials = [];
    mockWorkspaceData.versions = [];
    mockSave.mockReset();
    mockRefresh.mockReset();
    mockUploadFile.mockReset();
    mockValidatePDFHeader.mockReset();
    mockValidatePDFHeader.mockResolvedValue(undefined);
    mockRefresh.mockResolvedValue(undefined);
    mockUploadFile.mockImplementation(
      async (
        file: File,
        material: Material,
        userId: string,
        _mode: string,
        onProgress?: (n: number) => void,
      ) => {
        onProgress?.(100);
        return {
          id: `ver-${file.name}`,
          researchId: material.researchId,
          materialId: material.id,
          number: 0,
          fileName: file.name,
          storagePath: `${userId}/${material.researchId}/ver-${file.name}.pdf`,
          size: file.size,
          mimeType: "application/pdf",
          createdAt: "2026-11-23T00:00:00Z",
          updatedAt: "2026-11-23T00:00:00Z",
        };
      },
    );
    mockSave.mockImplementation(async (_kind: string, value: unknown) => value);
  });

  it("uploads multiple PDFs immediately with default private visibility in instant mode", async () => {
    render(
      <UploadQueueProvider>
        <Harness />
      </UploadQueueProvider>,
    );

    act(() => {
      api.enqueueCapture([makePdf("a.pdf"), makePdf("b.pdf"), makePdf("c.pdf")], {
        researchId: "r1",
      });
    });

    await waitFor(() => {
      expect(api.jobs).toHaveLength(3);
      expect(api.jobs.every((j) => j.status === "done")).toBe(true);
    });

    const materialCalls = mockSave.mock.calls.filter(([k]) => k === "materials");
    expect(materialCalls).toHaveLength(3);
    for (const [, payload] of materialCalls) {
      expect((payload as Material).visibility).toBe("private");
      expect((payload as Material).typeExplicit).toBe(false);
    }
    expect(api.recentUploadedByResearch["r1"]).toHaveLength(3);
  });

  it("stages files before upload in review mode and applies edited metadata", async () => {
    render(
      <UploadQueueProvider>
        <Harness />
      </UploadQueueProvider>,
    );

    act(() => {
      api.setCaptureMode("review");
    });

    act(() => {
      api.enqueueCapture([makePdf("raw_name.pdf")], { researchId: "r1" });
    });

    expect(api.stagedFiles).toHaveLength(1);
    expect(api.jobs).toHaveLength(0);

    act(() => {
      api.confirmStaged([
        {
          ...api.stagedFiles[0],
          title: "선행연구 핵심 논문",
          type: "reference",
          typeExplicit: true,
          visibility: "shared",
        },
      ]);
    });

    await waitFor(() => {
      expect(api.jobs[0]?.status).toBe("done");
    });

    const savedMat = mockSave.mock.calls.find(
      ([k]) => k === "materials",
    )?.[1] as Material;
    expect(savedMat.title).toBe("선행연구 핵심 논문");
    expect(savedMat.type).toBe("reference");
    expect(savedMat.typeExplicit).toBe(true);
    expect(savedMat.visibility).toBe("shared");
  });

  it("recovers from DB registration failure without re-uploading the file to storage", async () => {
    let failOnce = true;
    mockSave.mockImplementation(async (kind: string, value: unknown) => {
      if (kind === "versions" && failOnce) {
        failOnce = false;
        throw new Error("DB 등록 일시 오류");
      }
      return value;
    });

    render(
      <UploadQueueProvider>
        <Harness />
      </UploadQueueProvider>,
    );

    act(() => {
      api.enqueueCapture([makePdf("retry_db.pdf")], { researchId: "r1" });
    });

    await waitFor(() => {
      expect(api.jobs[0]?.status).toBe("failed_register");
    });
    expect(mockUploadFile).toHaveBeenCalledTimes(1);

    act(() => {
      api.retryJob(api.jobs[0].id);
    });

    await waitFor(() => {
      expect(api.jobs[0]?.status).toBe("done");
    });
    // R2 파일은 다시 올리지 않고 DB 등록만 재시도했는지 검증
    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    const matSaves = mockSave.mock.calls.filter(([k]) => k === "materials");
    expect(matSaves).toHaveLength(1);
  });

  it("handles partial failure and retries only the failed file", async () => {
    let failSecond = true;
    mockUploadFile.mockImplementation(
      async (file: File, material: Material, userId: string) => {
        if (file.name === "bad.pdf" && failSecond) {
          failSecond = false;
          throw new Error("네트워크 끊김");
        }
        return {
          id: `ver-${file.name}`,
          researchId: material.researchId,
          materialId: material.id,
          number: 0,
          fileName: file.name,
          storagePath: `${userId}/${material.researchId}/ver-${file.name}.pdf`,
          size: file.size,
          mimeType: "application/pdf",
          createdAt: "2026-11-23T00:00:00Z",
          updatedAt: "2026-11-23T00:00:00Z",
        };
      },
    );

    render(
      <UploadQueueProvider>
        <Harness />
      </UploadQueueProvider>,
    );

    act(() => {
      api.enqueueCapture([makePdf("ok.pdf"), makePdf("bad.pdf")], {
        researchId: "r1",
      });
    });

    await waitFor(() => {
      const ok = api.jobs.find((j) => j.file.name === "ok.pdf");
      const bad = api.jobs.find((j) => j.file.name === "bad.pdf");
      expect(ok?.status).toBe("done");
      expect(bad?.status).toBe("failed_upload");
    });

    act(() => {
      api.retryAllFailed();
    });

    await waitFor(() => {
      expect(api.jobs.every((j) => j.status === "done")).toBe(true);
    });
    // 성공했던 ok.pdf는 재업로드하지 않았으므로 총 3회 호출(ok 1 + bad 실패 1 + bad 재시도 1)
    expect(mockUploadFile).toHaveBeenCalledTimes(3);
  });
});
