import type { AIContext, Attachment } from "@/lib/domain";
import { t } from "@/lib/i18n";

/** Kokonut AI Attachment의 FileChip 모양. 확인되지 않은 쪽 수는 만들지 않아요. */
function fileMeta(file: AIContext, size?: number): string {
  const parts = [
    file.page ? t("{page}쪽", { page: file.page }) : undefined,
    size && size > 0 ? `${(size / 1_000_000).toFixed(1)} MB` : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : t("첨부 파일");
}

function badgeOf(title: string): string {
  const ext = title.split(".").pop()?.toUpperCase();
  return ext && ext.length <= 4 && ext !== title.toUpperCase() ? ext : "FILE";
}

export function MessageFileChips({
  files,
  attachments,
}: {
  files: AIContext[];
  attachments: ReadonlyArray<Pick<Attachment, "id" | "size">>;
}) {
  return (
    <ul
      className="m-0 flex list-none flex-col items-end gap-1.5 p-0"
      aria-label={t("첨부한 파일")}
    >
      {files.map((file) => {
        const size =
          file.kind === "attachments"
            ? attachments.find((item) => item.id === file.id)?.size
            : undefined;
        return (
          // Kokonut AI Attachment FileChip 원본 클래스(색만 토큰으로 바꿈)
          <li
            key={`${file.kind}:${file.id}:${file.page ?? ""}`}
            className="flex w-60 max-w-[85%] items-center gap-2.5 rounded-2xl bg-[var(--surface-raised)] p-2 pr-3 ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]"
          >
            <span
              aria-hidden="true"
              className="relative flex h-10 w-8 shrink-0 items-end justify-center rounded-[6px] bg-[var(--danger-soft)] pb-1 ring-1 ring-[color-mix(in_srgb,var(--danger)_15%,transparent)]"
            >
              <span className="absolute top-0 right-0 size-2 rounded-bl-[3px] bg-[color-mix(in_srgb,var(--danger)_20%,transparent)]" />
              <span className="font-bold text-[7.5px] text-[var(--danger)] tracking-wide">
                {badgeOf(file.title)}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-[13px] text-[var(--text)]">
                {file.title}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] text-[var(--text-tertiary)] tabular-nums">
                {fileMeta(file, size)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
