import { useId } from "react";
import { t } from "@/lib/i18n";

interface RequestDirectionProps {
  name?: string;
  purpose?: unknown;
  questions?: unknown;
  /** 학생이 보낼 내용을 미리 볼 때: 방향이 비었으면 그 사실을 알려 줍니다. */
  showEmpty?: boolean;
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/**
 * 검토 요청과 함께 교수님께 보이는 연구 정보: 연구 이름, 연구 목적, 연구 질문.
 * 교수 화면(검토 상세)과 학생의 '공유할 내용 확인'이 같은 모양을 씁니다.
 * 서버가 이미 거르지만, 예전 데이터나 미리보기 기록에 대비해 문자열만 씁니다.
 */
export function RequestDirection({
  name,
  purpose,
  questions,
  showEmpty = false,
}: RequestDirectionProps) {
  const headingId = useId();
  const cleanName = text(name);
  const cleanPurpose = text(purpose);
  const cleanQuestions = (Array.isArray(questions) ? questions : [])
    .map(text)
    .filter(Boolean);
  const empty = !cleanPurpose && !cleanQuestions.length;
  if (!cleanName && empty) return null;
  const label =
    empty && !showEmpty
      ? t("연구")
      : cleanName
        ? `${t("연구 방향")} · ${cleanName}`
        : t("연구 방향");
  return (
    <section
      className="review-source-block review-direction-block"
      aria-labelledby={headingId}
    >
      <span id={headingId}>{label}</span>
      {empty && !showEmpty && <p>{cleanName}</p>}
      {cleanPurpose && <p>{cleanPurpose}</p>}
      {!!cleanQuestions.length && (
        <ol>
          {cleanQuestions.map((question, index) => (
            <li key={`${index}-${question}`}>{question}</li>
          ))}
        </ol>
      )}
      {empty && showEmpty && (
        <p className="muted">
          {t("연구 목적과 질문을 아직 적지 않아 연구 이름만 보여요.")}
        </p>
      )}
    </section>
  );
}
