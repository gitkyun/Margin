import { t } from "@/lib/i18n";
import {
  formatDate,
  kstDateKey,
  type DocumentRecord,
  type Material,
} from "@/lib/domain";

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

/** 목록 표시용 자료 유형 라벨. 사용자가 유형을 고르지 않은 기본 'other'는 '미분류'로 표시합니다. */
export function materialDisplayTypeLabel(
  material: Pick<Material, "type" | "typeExplicit" | "externalUrl">,
): string {
  if (material.externalUrl) return t("링크");
  if (material.type === "other" && !material.typeExplicit) return t("미분류");
  return materialTypeLabel(material.type);
}
export function sinceLabel(at: string): string {
  const diff = Date.now() - new Date(at).getTime();
  if (!Number.isFinite(diff)) return "";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("방금");
  if (minutes < 60) return t("{count}분 전", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("{count}시간 전", { count: hours });
  return formatDate(kstDateKey(at));
}
export function domainOf(url?: string): string {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
}
