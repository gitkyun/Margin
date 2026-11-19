import { t } from "@/lib/i18n";
import { formatDate, type DocumentRecord, type Material } from "@/lib/domain";

/** 글·자료 목록(W1)과 자료 창(P4)이 함께 쓰는 이름표 */
export function documentTypeLabel(type: DocumentRecord["type"]): string {
  return { plan: t("계획서"), manuscript: t("원고"), note: t("메모") }[type];
}
export function materialTypeLabel(type: Material["type"] | "link"): string {
  return {
    draft: t("초안"),
    reference: t("참고"),
    analysis: t("분석"),
    other: t("기타"),
    link: t("링크"),
  }[type];
}
export function sinceLabel(at: string): string {
  const diff = Date.now() - new Date(at).getTime();
  if (!Number.isFinite(diff)) return "";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("방금");
  if (minutes < 60) return t("{count}분 전", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{count}시간 전", { count: hours });
  return formatDate(at.slice(0, 10));
}
export function domainOf(url?: string): string {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
}
