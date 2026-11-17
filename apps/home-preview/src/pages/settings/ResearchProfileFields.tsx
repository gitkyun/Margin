import { t, tc } from "@/lib/i18n";
import { useId } from "react";
import { TagChips } from "@/components/TagChips";
import { Choice } from "@/components/experience";
import {
  KEYWORD_MAX_LENGTH,
  MAX_KEYWORDS,
  addKeyword,
  citationStyleOptions,
  isKeyword,
} from "@/lib/research-profile";

interface ResearchProfileFieldsProps {
  keywords: string[];
  onKeywordsChange: (keywords: string[]) => void;
  keywordDraft: string;
  onKeywordDraftChange: (draft: string) => void;
  citation: string;
  onCitationChange: (citation: string) => void;
  disabled?: boolean;
}

/** 키워드는 쉼표·세미콜론·줄바꿈으로 나눠요(띄어쓰기는 '질적 연구'처럼 키워드 안에 들어갑니다). */
const KEYWORD_SEPARATOR = /[,;\n]+/;

/**
 * 연구 설정 › 기본 정보의 연구 키워드(칩)와 목표 학회 인용 양식.
 * 값은 연구 기본 정보 저장 버튼으로 함께 저장합니다(rms_researches.data).
 */
export function ResearchProfileFields({
  keywords,
  onKeywordsChange,
  keywordDraft,
  onKeywordDraftChange,
  citation,
  onCitationChange,
  disabled = false,
}: ResearchProfileFieldsProps) {
  const keywordId = useId();
  const keywordHintId = useId();
  const citationId = useId();
  return (
    <>
      <div className="field">
        <label htmlFor={keywordId}>
          {t("연구 키워드")} <small>{tc("optional", "선택")}</small>
        </label>
        <fieldset disabled={disabled} className="research-keyword-field">
          <TagChips
            id={keywordId}
            values={keywords}
            onChange={onKeywordsChange}
            draft={keywordDraft}
            onDraftChange={onKeywordDraftChange}
            add={addKeyword}
            isValid={isKeyword}
            max={MAX_KEYWORDS}
            separator={KEYWORD_SEPARATOR}
            maxLength={KEYWORD_MAX_LENGTH}
            fullNote={t("키워드는 {count}개까지 적을 수 있어요.", {
              count: MAX_KEYWORDS,
            })}
            placeholder={t("예: 질적 연구, 지도 미팅")}
            aria-describedby={keywordHintId}
          />
        </fieldset>
        <small id={keywordHintId} className="field-hint">
          {t(
            "Enter나 쉼표로 하나씩 넣어요. {count}개까지, 하나에 {length}자까지 적을 수 있어요.",
            { count: MAX_KEYWORDS, length: KEYWORD_MAX_LENGTH },
          )}
        </small>
      </div>
      <div className="field">
        <label htmlFor={citationId}>
          {t("목표 학회 인용 양식")} <small>{tc("optional", "선택")}</small>
        </label>
        <Choice
          id={citationId}
          value={citation}
          label={t("목표 학회 인용 양식")}
          options={citationStyleOptions()}
          onChange={onCitationChange}
          disabled={disabled}
        />
        <small className="field-hint">
          {t(
            "투고할 곳이 쓰는 양식을 골라 두면 연구 정보에 함께 기록돼요. 원고의 인용을 자동으로 바꾸지는 않아요.",
          )}
        </small>
      </div>
    </>
  );
}
