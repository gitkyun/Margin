import { dateLocale, t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { Segments } from "@/components/experience";
import {
  VersionCompareSlider,
  VersionSheet,
} from "@/components/VersionCompareSlider";
import type { DocumentVersion } from "@/lib/domain";
import { WordDiff } from "@/pages/writing/WordDiff";

export type CompareMode = "words" | "slider";

/**
 * 비교 보기(IA v2 05 §3.7). 버전을 고르면 본문 자리가 이 화면으로 바뀝니다(`?compare=<버전 id>`).
 * 머리: "v2(11월 10일)와 지금" · 단어 비교 | 슬라이더 · [이 버전으로 되살리기] · [닫기].
 * 되살리기는 지금 내용을 지우지 않고, 고른 버전 내용을 새 버전으로 남깁니다.
 */
export function CompareView({
  version,
  current,
  mode,
  onMode,
  onRestore,
  onClose,
  busy,
}: {
  version: DocumentVersion;
  current: string;
  mode: CompareMode;
  onMode: (mode: CompareMode) => void;
  onRestore: () => void;
  onClose: () => void;
  busy: boolean;
}) {
  const label = `v${version.number}`;
  return (
    <section className="compare-view" aria-label={t("버전 비교")}>
      <div className="compare-view-head">
        <h2>
          {t("{version}({date})와 지금", {
            version: label,
            // 괄호 안에 또 괄호가 생기지 않게 요일 없이 씁니다.
            date: new Intl.DateTimeFormat(dateLocale(), {
              month: "long",
              day: "numeric",
            }).format(new Date(version.createdAt)),
          })}
        </h2>
        <Segments
          label={t("비교 방식")}
          size="small"
          value={mode}
          onChange={(next) => onMode(next as CompareMode)}
          options={[
            { value: "words", label: t("단어 비교") },
            { value: "slider", label: t("슬라이더") },
          ]}
        />
        <span className="compare-view-actions">
          <Button variant="outline" disabled={busy} onClick={onRestore}>
            {t("이 버전으로 되살리기")}
          </Button>
          <Button variant="outline" onClick={onClose}>
            <Icon name="close" size={16} />
            {t("닫기")}
          </Button>
        </span>
      </div>
      <p className="compare-view-note">
        {t(
          "되살리면 지금 내용은 지우지 않고, {version} 내용을 새 버전으로 남겨요.",
          { version: label },
        )}
      </p>
      {mode === "words" ? (
        <WordDiff before={version.text} after={current} />
      ) : (
        <div>
          <div className="version-compare-scroll">
            <VersionCompareSlider
              label={t("{before} · {after} 비교", {
                before: label,
                after: t("지금"),
              })}
              sideLabels={{
                before: t("이전 버전 · {label}", { label }),
                after: t("현재 버전"),
              }}
              before={
                <VersionSheet tone="before" label={label} text={version.text} />
              }
              after={
                <VersionSheet tone="after" label={t("지금")} text={current} />
              }
            />
          </div>
          <p className="version-compare-hint">
            {t(
              "가운데 손잡이를 끌거나, 손잡이에 포커스를 두고 좌우 방향키로 5%씩 옮겨요.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
