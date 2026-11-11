import { t } from "@/lib/i18n";
import { Link } from "react-router-dom";
import type { Research } from "@/lib/domain";
import { hasDirection } from "@/lib/research-direction";
import { Button } from "../ui/button";

interface ResearchDirectionProps {
  research: Pick<Research, "purpose" | "questions">;
  /** 연구 설정의 기본 정보 주소. 고치기와 적어 두기가 여기로 갑니다. */
  settingsHref: string;
  /** 계획서 첫 문단. 있으면 '계획서에서 가져오기'를 보여 줍니다. */
  planExcerpt: string | null;
  busy: boolean;
  onImport: (purpose: string) => void;
}

/**
 * 연구 홈 머리의 연구 방향: 연구 목적 한두 문장과 연구 질문 목록.
 * 비어 있으면 적어 두기와 계획서에서 가져오기 두 가지 길만 보여 줍니다.
 */
export function ResearchDirection({
  research,
  settingsHref,
  planExcerpt,
  busy,
  onImport,
}: ResearchDirectionProps) {
  if (!hasDirection(research))
    return (
      <div className="rh-direction is-empty">
        <span>{t("연구 목적과 질문을 아직 적지 않았어요.")}</span>
        <Button asChild variant="link" size="sm">
          <Link to={settingsHref}>{t("적어 두기")}</Link>
        </Button>
        {planExcerpt && (
          <Button
            variant="link"
            size="sm"
            disabled={busy}
            onClick={() => onImport(planExcerpt)}
          >
            {t("계획서에서 가져오기")}
          </Button>
        )}
      </div>
    );
  return (
    <section className="rh-direction" aria-label={t("연구 방향")}>
      <div className="rh-direction-head">
        <h2>{t("연구 방향")}</h2>
        <Button asChild variant="link" size="sm">
          <Link to={settingsHref}>{t("고치기")}</Link>
        </Button>
      </div>
      {research.purpose?.trim() && <p>{research.purpose}</p>}
      {!!research.questions?.length && (
        <ol>
          {research.questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
