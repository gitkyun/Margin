import { t } from "@/lib/i18n";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ErrorNotice,
  FormDialog,
  LabeledInput,
  LabeledText,
  SaveActions,
  useSaving,
} from "@/pages/student/shared";
import { VisibilityField } from "@/components/experience";
import { DialogBody } from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/workspace";
import { seoulToday } from "@/lib/home-meeting";
import { recordBase, type BaseRecord, type Meeting } from "@/lib/domain";

/** 서면 피드백 내용 한도(IA v2 04 §7.2) */
export const WRITTEN_MAX = 50_000;

type Source = NonNullable<Meeting["sourceLabel"]>;
const SOURCES: Source[] = ["kakao", "email", "doc_comment", "note", "other"];

export function sourceLabel(source: Source): string {
  return {
    kakao: t("카톡"),
    email: t("메일"),
    doc_comment: t("문서 댓글"),
    note: t("메모"),
    file: t("파일"),
    other: t("기타"),
  }[source];
}

/** 받은 날에서 기본 제목: "11월 12일 서면 피드백" */
export function writtenTitle(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return month && day
    ? t("{month}월 {day}일 서면 피드백", { month, day })
    : t("서면 피드백");
}

/**
 * 서면 피드백 붙여넣기(IA v2 04 §7.2). 카톡·메일로 받은 지도 의견을 기록 한 건으로 남깁니다.
 * 미팅 표에 `recordType: 'written'`, `status: 'recorded'`로 저장합니다(마이그레이션 없음, 08 §3.1).
 */
export function WrittenFeedbackDialog({
  researchId,
  open,
  onOpenChange,
}: {
  researchId: string;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { data, save } = useWorkspace();
  const navigate = useNavigate();
  const form = useSaving();
  const base = useRef<BaseRecord | null>(null);
  const [date, setDate] = useState(seoulToday());
  const [title, setTitle] = useState(writtenTitle(seoulToday()));
  const [titleTouched, setTitleTouched] = useState(false);
  const [source, setSource] = useState<Source>("kakao");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"private" | "shared">("private");
  const research = data.researches.find((item) => item.id === researchId);
  const collaborative = data.members.some(
    (member) =>
      member.researchId === researchId &&
      member.status === "active" &&
      member.userId !== research?.ownerId,
  );

  useEffect(() => {
    if (!open) return;
    const today = seoulToday();
    base.current = recordBase(researchId);
    setDate(today);
    setTitle(writtenTitle(today));
    setTitleTouched(false);
    setSource("kakao");
    setBody("");
    setVisibility("private");
    form.setError(null);
  }, [open, researchId]);

  const tooLong = body.length > WRITTEN_MAX;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      form.setError(t("제목을 적어 주세요."));
      return;
    }
    if (!body.trim()) {
      form.setError(t("받은 내용을 붙여 넣어 주세요."));
      return;
    }
    if (tooLong) {
      form.setError(t("50,000자까지 넣을 수 있어요. 나눠서 넣어 주세요."));
      return;
    }
    await form.perform(async () => {
      base.current ??= recordBase(researchId);
      const record = await save("meetings", {
        ...base.current,
        recordType: "written",
        sourceLabel: source,
        title: title.trim().slice(0, 200),
        date: date || seoulToday(),
        time: null,
        status: "recorded",
        goal: "",
        memo: body,
        memoRevision: 1,
        visibility,
        taskIds: [],
        versionIds: [],
        questionIds: [],
      } as Meeting);
      onOpenChange(false);
      toast.success(t("서면 피드백을 기록으로 남겼어요."));
      navigate(`/r/${researchId}/meetings/${record.id}`);
    });
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      busy={form.saving}
      title={t("서면 피드백 붙여넣기")}
      description={t(
        "카톡·메일·문서 댓글로 받은 의견을 붙여 넣으면 기록 한 건으로 남아요.",
      )}
    >
      <form className="written-form" onSubmit={submit}>
        <DialogBody>
          <LabeledInput
            label={t("제목")}
            required
            value={title}
            onChange={(value) => {
              setTitle(value);
              setTitleTouched(true);
            }}
          />
          <div className="form-grid">
            <LabeledInput
              label={t("받은 날")}
              type="date"
              value={date}
              onChange={(value) => {
                setDate(value);
                if (!titleTouched && value) setTitle(writtenTitle(value));
              }}
            />
            <label className="field">
              <span>{t("어디서 받았나요")}</span>
              <select
                className="native-select"
                value={source}
                onChange={(event) => setSource(event.target.value as Source)}
              >
                {SOURCES.map((value) => (
                  <option key={value} value={value}>
                    {sourceLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            onPasteCapture={(event) => {
              const hasImage = Array.from(event.clipboardData.items).some(
                (item) =>
                  item.kind === "file" && item.type.startsWith("image/"),
              );
              if (hasImage)
                toast.info(
                  t("사진은 아직 넣을 수 없어요. 글자만 붙여 넣어 주세요."),
                );
            }}
          >
            <LabeledText
              label={t("내용")}
              required
              rows={10}
              value={body}
              onChange={setBody}
              placeholder={t("받은 내용을 그대로 붙여 넣어 주세요.")}
              error={
                tooLong
                  ? t("50,000자까지 넣을 수 있어요. 나눠서 넣어 주세요.")
                  : undefined
              }
            />
            <p className="written-count" aria-live="polite">
              {t("{count} / {max}자", {
                count: body.length.toLocaleString(),
                max: WRITTEN_MAX.toLocaleString(),
              })}
            </p>
          </div>
          {collaborative && (
            <VisibilityField value={visibility} onChange={setVisibility} />
          )}
          <ErrorNotice error={form.error} />
        </DialogBody>
        <SaveActions
          saving={form.saving}
          onCancel={() => onOpenChange(false)}
          label={t("저장")}
        />
      </form>
    </FormDialog>
  );
}
