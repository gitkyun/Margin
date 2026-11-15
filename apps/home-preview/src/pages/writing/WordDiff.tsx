import { t } from "@/lib/i18n";
import { diffWords } from "diff";

/** 두 글을 낱말 단위로 비교해 지운 곳과 더한 곳을 표시해요. */
export function WordDiff({ before, after }: { before: string; after: string }) {
  const changes = diffWords(before, after, {
    intlSegmenter: new Intl.Segmenter("ko", { granularity: "word" }),
  });
  return (
    <div className="text-comparison">
      <div className="diff-legend">
        <span>
          <i className="removed" />
          {t("삭제")}
        </span>
        <span>
          <i className="added" />
          {t("추가")}
        </span>
      </div>
      <div className="diff-content">
        {changes.map((c, i) =>
          c.added ? (
            <ins key={i}>{c.value}</ins>
          ) : c.removed ? (
            <del key={i}>{c.value}</del>
          ) : (
            <span key={i}>{c.value}</span>
          ),
        )}
      </div>
    </div>
  );
}
