import { t } from "@/lib/i18n";
import type { Material, MaterialVersion } from "@/lib/domain";
import { UploadConnectionError } from "@/lib/repository";

export interface PdfUploadDeps {
  save(kind: "materials", value: Material): Promise<Material>;
  upload(
    file: File,
    material: Material,
    onProgress?: (value: number) => void,
    signal?: AbortSignal,
  ): Promise<MaterialVersion>;
  remove(kind: "materials", id: string): Promise<void>;
}

export class OrphanMaterialError extends Error {
  constructor() {
    super(
      t(
        "파일을 올리지 못했어요. 함께 만든 빈 자료가 자료 목록에 남았을 수 있어요. 필요 없으면 그 자료를 열어 ‘자료 보관’을 눌러 주세요.",
      ),
    );
    this.name = "OrphanMaterialError";
  }
}

export function pendingUploadKey(researchId: string) {
  return `rms-pending-upload-${researchId}`;
}

// Only files that actually arrived should leave a material behind. A failed
// or cancelled transfer removes the material created for it; a connection
// failure keeps it so the uploaded file can be linked without re-uploading.
export async function registerPdf(
  deps: PdfUploadDeps,
  input: {
    draft: Material;
    isNew: boolean;
    file: File;
    onProgress?: (value: number) => void;
    signal?: AbortSignal;
    onMaterialSaved?: (material: Material) => void;
  },
): Promise<{ material: Material; version: MaterialVersion }> {
  const material = await deps.save("materials", input.draft);
  input.onMaterialSaved?.(material);
  try {
    const version = await deps.upload(
      input.file,
      material,
      input.onProgress,
      input.signal,
    );
    return { material, version };
  } catch (error) {
    if (input.isNew && !(error instanceof UploadConnectionError)) {
      try {
        await deps.remove("materials", material.id);
      } catch {
        throw new OrphanMaterialError();
      }
    }
    throw error;
  }
}
