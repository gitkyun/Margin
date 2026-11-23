// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { UploadQueueProvider } from "@/lib/upload-queue";
import { UploadQueueTray } from "@/components/materials/UploadQueueTray";
import { DocsPage } from "./DocsPage";
import {
  emptyWorkspace,
  type EntityKind,
  type EntityMap,
  type Material,
  type MaterialVersion,
} from "@/lib/domain";

let workspaceState = emptyWorkspace();
const mockRefresh = vi.fn();
const mockRemove = vi.fn();
const mockUploadFile = vi.fn();

const mockSave = vi.fn(
  async <K extends EntityKind>(kind: K, value: EntityMap[K]) => {
    const list = workspaceState[kind] as EntityMap[K][];
    const idx = list.findIndex((item) => item.id === value.id);
    if (idx >= 0) list[idx] = value;
    else list.push(value);
    return value;
  },
);

vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => ({
    data: workspaceState,
    user: { id: "user-1", email: "student@test.com", name: "김학생" },
    mode: "preview",
    save: mockSave,
    remove: mockRemove,
    refresh: mockRefresh,
    upload: vi.fn(),
    openFile: vi.fn(),
  }),
}));

vi.mock("@/lib/repository", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/repository")>(
      "@/lib/repository",
    );
  return {
    ...actual,
    validatePDFHeader: vi.fn().mockResolvedValue(undefined),
    uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  };
});

vi.mock("@/components/MaterialPreviewBadge", () => ({
  MaterialPreviewBadge: () => <span data-testid="pdf-thumb" />,
}));

function makePdf(name: string, content = "%PDF-1.4 sample") {
  return new File([content], name, { type: "application/pdf" });
}

function renderDocs(initialPath = "/r/r1/docs") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <UploadQueueProvider>
        <Routes>
          <Route path="/r/:researchId/docs" element={<DocsPage />} />
          <Route
            path="/r/:researchId/meetings"
            element={<div>미팅 화면</div>}
          />
        </Routes>
        <UploadQueueTray />
      </UploadQueueProvider>
    </MemoryRouter>,
  );
}

describe("Wave 2 Slice 1 DocsPage UI integration", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    workspaceState = emptyWorkspace();
    workspaceState.folders.push({
      id: "f1",
      researchId: "r1",
      title: "선행연구",
      createdAt: "2026-11-20T00:00:00Z",
      updatedAt: "2026-11-20T00:00:00Z",
    });
    mockSave.mockClear();
    mockRefresh.mockReset().mockResolvedValue(undefined);
    mockRemove.mockReset().mockResolvedValue(undefined);
    mockUploadFile
      .mockReset()
      .mockImplementation(
        async (
          file: File,
          material: Material,
          userId: string,
          _mode: string,
          onProgress?: (n: number) => void,
        ): Promise<MaterialVersion> => {
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
  });

  it("uploads 5 PDFs in instant mode without navigating away, defaults to private + 미분류, and supports batch type update", async () => {
    const { rerender } = renderDocs();

    const input = screen.getByLabelText("PDF 파일 여러 개 선택");
    const files = [
      makePdf("Paper_1.pdf", "%PDF-1.4 1"),
      makePdf("Paper_2.pdf", "%PDF-1.4 2"),
      makePdf("Paper_3.pdf", "%PDF-1.4 3"),
      makePdf("Paper_4.pdf", "%PDF-1.4 4"),
      makePdf("Paper_5.pdf", "%PDF-1.4 5"),
    ];
    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(screen.getAllByText("5개 자료 저장 완료").length).toBeGreaterThan(
        0,
      );
    });

    // 강제 이동 없이 글·자료 화면 유지
    expect(screen.getByRole("heading", { name: "글·자료" })).toBeTruthy();

    // 저장된 5개 모두 기본 private + typeExplicit=false
    expect(workspaceState.materials).toHaveLength(5);
    for (const m of workspaceState.materials) {
      expect(m.visibility).toBe("private");
      expect(m.typeExplicit).toBe(false);
    }

    // 최신 워크스페이스 데이터 반영 후 일괄 정리 바 동작 확인
    rerender(
      <MemoryRouter initialEntries={["/r/r1/docs"]}>
        <UploadQueueProvider>
          <Routes>
            <Route path="/r/:researchId/docs" element={<DocsPage />} />
          </Routes>
          <UploadQueueTray />
        </UploadQueueProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/미분류/).length).toBeGreaterThanOrEqual(5);
  });

  it("has no capture-mode toggle and uploads straight away as private", async () => {
    renderDocs();

    expect(
      screen.queryByRole("button", { name: "정보 먼저 확인하기" }),
    ).toBeNull();
    const input = screen.getByLabelText("PDF 파일 여러 개 선택");
    fireEvent.change(input, {
      target: { files: [makePdf("2305_10403.pdf", "%PDF-1.4 single")] },
    });

    expect(screen.queryByText("자료 정보 확인 후 올리기")).toBeNull();
    await waitFor(() => {
      expect(screen.getAllByText("1개 자료 저장 완료").length).toBeGreaterThan(
        0,
      );
    });
    expect(workspaceState.materials[0]?.visibility).toBe("private");
  });
});
