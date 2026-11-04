import { describe, expect, it, vi } from "vitest";
import type { Material, MaterialVersion } from "@/lib/domain";
import { UploadConnectionError } from "@/lib/repository";
import { OrphanMaterialError, registerPdf } from "./material-upload";

const draft = {
  id: "material-1",
  researchId: "research",
  title: "가상 원고",
  type: "draft",
} as Material;
const version = {
  id: "version-1",
  materialId: "material-1",
  number: 2,
} as MaterialVersion;
const file = new File(["%PDF-"], "manuscript-v2.pdf", {
  type: "application/pdf",
});

function deps(upload: () => Promise<MaterialVersion>) {
  return {
    save: vi.fn(async (_kind: "materials", value: Material) => ({
      ...value,
      updatedAt: "saved",
    })),
    upload: vi.fn(upload),
    remove: vi.fn(async () => undefined),
  };
}

describe("PDF 등록 실패 시 빈 자료 정리", () => {
  it("성공하면 저장한 자료와 새 버전을 돌려준다", async () => {
    const d = deps(async () => version);
    const result = await registerPdf(d, { draft, isNew: true, file });
    expect(result.version).toBe(version);
    expect(result.material.updatedAt).toBe("saved");
    expect(d.remove).not.toHaveBeenCalled();
  });

  it("새 자료의 파일 전송이 실패하거나 중단되면 방금 만든 자료를 지운다", async () => {
    const d = deps(async () => {
      throw new Error("전송 실패");
    });
    await expect(registerPdf(d, { draft, isNew: true, file })).rejects.toThrow(
      "전송 실패",
    );
    expect(d.remove).toHaveBeenCalledWith("materials", "material-1");
  });

  it("파일은 올라가고 연결만 실패했다면 다시 연결할 수 있도록 자료를 남긴다", async () => {
    const d = deps(async () => {
      throw new UploadConnectionError(version);
    });
    await expect(
      registerPdf(d, { draft, isNew: true, file }),
    ).rejects.toBeInstanceOf(UploadConnectionError);
    expect(d.remove).not.toHaveBeenCalled();
  });

  it("기존 자료에 새 버전을 올리다 실패하면 기존 자료는 지우지 않는다", async () => {
    const d = deps(async () => {
      throw new Error("전송 실패");
    });
    await expect(registerPdf(d, { draft, isNew: false, file })).rejects.toThrow(
      "전송 실패",
    );
    expect(d.remove).not.toHaveBeenCalled();
  });

  it("빈 자료 정리마저 실패하면 남은 자료를 확인하라고 알린다", async () => {
    const d = deps(async () => {
      throw new Error("전송 실패");
    });
    d.remove.mockRejectedValueOnce(new Error("삭제 실패"));
    await expect(
      registerPdf(d, { draft, isNew: true, file }),
    ).rejects.toBeInstanceOf(OrphanMaterialError);
  });
});
