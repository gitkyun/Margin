import { assertConnected } from "@/lib/supabase";
import { useNavigationGuard } from "@/lib/navigation-guard";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/experience";
import { Checkbox } from "@montage-ui/core";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, StatusBadge } from "@/components/common";
import { SectionBoundary } from "@/components/SectionBoundary";
import { Icon } from "@/components/icons";
import { PdfViewer } from "@/components/PdfViewer";
import { useWorkspace } from "@/lib/workspace";
import { uid, type MaterialVersion } from "@/lib/domain";
import {
  evidenceIssue,
  errorText,
  knownProfessorEmails,
  sourceExcerpt,
} from "@/pages/reviews/helpers";
import { addAdvisor, advisorChoices } from "@/lib/advisors";
import { isUnregisteredReviewer } from "@/lib/invites";
import { InviteLinkButton } from "@/components/InviteLinkButton";
import { localizeServerMessage } from "@/lib/server-messages";
import { RequestDirection } from "@/pages/reviews/RequestDirection";
// 창의 모양(공개 미리보기·수정 결과 고르기)은 검토 화면과 같은 스타일 파일에 있습니다. 이 파일은 창을 열 때만 불러옵니다.
import "@/pages/reviews/reviews.css";

/**
 * 검토 요청 만들기 창(01 §3.3 `new=review`). 예전 검토 요청 화면에 있던 창을 그대로 옮겼습니다:
 * 제목·교수 계정·수정 결과 고르기 → 공유할 내용 확인 → 검토 링크 만들기. 링크를 만들 뿐 보내지는 않습니다.
 * `initialResultIds`가 있으면 그 수정 결과를 골라 둔 채 엽니다.
 */
export function ReviewComposeDialog({
  researchId,
  open,
  initialResultIds = [],
  onClose,
  onWriteResult,
}: {
  researchId: string;
  open: boolean;
  initialResultIds?: string[];
  onClose(): void;
  /** 수정 결과가 없을 때 [수정 결과 작성]: 이 창을 닫고 작성 창을 엽니다. */
  onWriteResult(): void;
}) {
  const { data, createReview, saveResearch, user, mode } = useWorkspace();
  const navigate = useNavigate();
  const [step, setStep] = useState<"compose" | "preview">("compose");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [error, setError] = useState("");
  const [previewFile, setPreviewFile] = useState<MaterialVersion | null>(null);
  const requestKey = useRef(uid());
  const research = data.researches.find((r) => r.id === researchId);
  // 연구에 등록한 지도교수가 먼저, 그다음 전에 검토를 요청한 이메일.
  const professors = useMemo(
    () =>
      advisorChoices(
        research?.advisorEmails,
        knownProfessorEmails(data.reviews, researchId),
      ),
    [research?.advisorEmails, data.reviews, researchId],
  );
  // 미리 채운 이메일은 사용자가 쓴 내용이 아니므로 "버릴 내용"으로 세지 않습니다.
  const emailEdited = email.trim() !== (professors[0] ?? "");
  const requestGuard = useNavigationGuard({
    dirty: open && (!!title.trim() || emailEdited || selected.length > 0),
    busy,
    label: t("검토 요청"),
    onDiscard: onClose,
  });
  const results = useMemo(
    () =>
      data.results
        .filter((r) => r.researchId === researchId && !r.archivedAt)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.results, researchId],
  );
  const picks = results.filter((r) => selected.includes(r.id));
  // 열 때마다 새로 시작합니다. 골라 둔 수정 결과가 있으면 제목을 그 이름으로 채웁니다.
  const initialKey = initialResultIds.join(",");
  useEffect(() => {
    if (!open) return;
    requestKey.current = uid();
    const ids = [...new Set(initialResultIds)].filter((id) =>
      results.some((r) => r.id === id),
    );
    const first = results.find((r) => r.id === ids[0])?.title ?? t("수정 결과");
    setSelected(ids);
    setEmail(professors[0] ?? "");
    setTitle(
      !ids.length
        ? ""
        : ids.length > 1
          ? t("{title} 외 {count}건 검토", {
              title: first,
              count: ids.length - 1,
            })
          : t("{title} 검토", { title: first }),
    );
    setError("");
    setStep("compose");
    setPreviewFile(null);
    setDiscardOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey]);
  useEffect(() => {
    requestKey.current = uid();
  }, [title, email, selected]);
  const close = () => {
    if (busy) return;
    requestKey.current = uid();
    requestGuard.clear();
    setDiscardOpen(false);
    setError("");
    setPreviewFile(null);
    onClose();
  };
  const requestClose = () => {
    if (busy) return;
    if (title.trim() || emailEdited || selected.length) setDiscardOpen(true);
    else close();
  };
  const validate = () => {
    if (!title.trim()) return t("검토 요청 제목을 적어 주세요.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return t(
        "이메일 형식이 맞지 않아요. 교수님 계정 이메일을 확인해 주세요.",
      );
    if (email.trim().toLowerCase() === user.email.toLowerCase())
      return t(
        "내 계정 이메일은 지정할 수 없어요. 교수님 계정 이메일을 적어 주세요.",
      );
    if (!picks.length)
      return t("검토받을 수정 결과를 하나 이상 선택해 주세요.");
    for (const result of picks) {
      const issue = evidenceIssue(result, data);
      if (issue) return `${result.title}: ${issue}`;
    }
    return "";
  };
  const showPreview = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const issue = validate();
    setError(issue);
    if (issue) return;
    setBusy(true);
    try {
      if (mode === "connected") {
        const response = await assertConnected().rpc("rms_validate_reviewer", {
          p_research_id: researchId,
          p_email: email.trim().toLowerCase(),
        });
        if (response.error)
          throw new Error(localizeServerMessage(response.error.message));
      }
      setStep("preview");
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };
  // 직접 입력해 보낸 교수는 이 연구의 지도교수로 등록해 다음부터 고르기만 하게 합니다.
  // 등록에 실패해도 검토 요청은 이미 만들어졌으므로 알리기만 합니다.
  const registerAdvisor = async (professorEmail: string) => {
    if (!research) return;
    const current = research.advisorEmails ?? [];
    const next = addAdvisor(current, professorEmail);
    if (next === current) return;
    try {
      await saveResearch({ ...research, advisorEmails: next });
    } catch {
      toast.error(
        t("지도교수 목록에 추가하지 못했어요. 연구 설정에서 등록할 수 있어요."),
      );
    }
  };
  const submit = async () => {
    const issue = validate();
    setError(issue);
    if (issue || busy) return;
    setBusy(true);
    try {
      const request = await createReview({
        researchId,
        title: title.trim(),
        professorEmail: email.trim().toLowerCase(),
        resultIds: picks.map((r) => r.id),
        requestKey: requestKey.current,
      });
      requestKey.current = uid();
      requestGuard.clear();
      onClose();
      void registerAdvisor(request.professorEmail);
      toast.success(
        t(
          "검토 링크를 만들었어요. 링크를 복사해서 교수님께 직접 전달해 주세요.",
        ),
      );
      navigate(`/reviews/${request.id}`);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value: boolean) => {
          if (!value) requestClose();
        }}
      >
        <DialogContent
          showCloseButton={!busy}
          className="review-compose-dialog"
          disableEscapeKeyDownClose={busy}
          disableOutsideClickClose
        >
          <DialogHeader>
            <DialogTitle>
              {step === "compose"
                ? t("검토 요청 만들기")
                : t("공유할 내용 확인")}
            </DialogTitle>
            <DialogDescription>
              {step === "compose"
                ? t(
                    "링크를 만들기 전에 교수님께 공개될 내용을 확인할 수 있어요.",
                  )
                : t(
                    "링크를 만들면 아래 연구 방향과 내용, 첨부 파일 전체가 지정한 교수 계정에 공개돼요.",
                  )}
            </DialogDescription>
          </DialogHeader>
          {step === "compose" ? (
            <form onSubmit={showPreview}>
              <DialogBody>
                <Field label={t("검토 요청 제목")} required>
                  <Input
                    aria-label={t("검토 요청 제목")}
                    value={title}
                    maxLength={180}
                    onChange={(
                      e: ChangeEvent<
                        | HTMLInputElement
                        | HTMLTextAreaElement
                        | HTMLSelectElement
                      >,
                    ) => setTitle(e.target.value)}
                    placeholder={t("예: 선행연구 표와 연구 질문 수정 결과")}
                  />
                </Field>
                <Field
                  label={t("검토할 교수")}
                  required
                  hint={
                    professors.length > 0
                      ? t("지도교수는 연구 설정에서 추가하거나 뺄 수 있어요.")
                      : t(
                          "이 이메일로 등록된 마진 계정만 검토를 열 수 있어요. 보내면 이 연구의 지도교수로 등록돼요.",
                        )
                  }
                >
                  {professors.length > 0 && (
                    <Choice
                      label={t("검토할 교수")}
                      value={email}
                      onChange={setEmail}
                      options={professors.map((p) => ({ value: p, label: p }))}
                    />
                  )}
                  {professors.length === 0 && (
                    <Input
                      aria-label={t("교수 계정 이메일")}
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(
                        e: ChangeEvent<
                          | HTMLInputElement
                          | HTMLTextAreaElement
                          | HTMLSelectElement
                        >,
                      ) => setEmail(e.target.value)}
                      placeholder="professor@example.com"
                    />
                  )}
                </Field>
                <fieldset className="review-result-selection">
                  <legend>
                    {t("검토받을 수정 결과")}{" "}
                    <span className="review-required">{t("필수")}</span>
                  </legend>
                  {!results.length ? (
                    <p className="muted">
                      {t("아직 수정 결과가 없어요.")}{" "}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => {
                          close();
                          onWriteResult();
                        }}
                      >
                        {t("수정 결과 작성")}
                      </Button>
                    </p>
                  ) : (
                    results.map((result) => {
                      const issue = evidenceIssue(result, data);
                      return (
                        <label className="review-pick-row" key={result.id}>
                          <Checkbox
                            checked={selected.includes(result.id)}
                            onCheckedChange={(checked: boolean) =>
                              setSelected((current) =>
                                checked
                                  ? [...current, result.id]
                                  : current.filter((id) => id !== result.id),
                              )
                            }
                          />
                          <span>
                            <strong>{result.title}</strong>
                            <small>{issue || result.description}</small>
                            {issue && (
                              <span className="review-evidence-warning">
                                {t("보완 필요")}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })
                  )}
                </fieldset>
                <div className="review-inline-note">
                  <Icon name="lock" size={17} />
                  <p>
                    {t(
                      "개인 메모, 할 일 목록, AI 대화, 선택하지 않은 AI 제안은 포함되지 않아요.",
                    )}
                  </p>
                </div>
                {error && (
                  <p className="review-form-error" role="alert">
                    {error}
                  </p>
                )}
                {isUnregisteredReviewer(error) && (
                  <div className="invite-hint">
                    <InviteLinkButton />
                    <span>
                      {t(
                        "복사한 링크를 교수님께 직접 보내 주세요. 가입한 뒤에 검토 요청을 보낼 수 있어요.",
                      )}
                    </span>
                  </div>
                )}
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={requestClose}
                >
                  {t("취소")}
                </Button>
                <Button type="submit" disabled={busy || !results.length}>
                  {busy ? t("교수 계정 확인 중") : t("공유할 내용 확인")}
                  <Icon name="arrow-right" size={16} />
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <>
              <DialogBody className="review-public-preview">
                <div className="review-preview-heading">
                  <StatusBadge tone="blue">
                    {t("교수에게 공개될 내용")}
                  </StatusBadge>
                  <h3>{title}</h3>
                  <p className="muted">
                    {t("열 수 있는 계정 · {email}", { email })}
                  </p>
                </div>
                <RequestDirection
                  name={research?.name}
                  purpose={research?.purpose}
                  questions={research?.questions}
                  showEmpty
                />
                {picks.map((result, index) => {
                  const version = data.versions.find(
                      (r) => r.id === result.versionId,
                    ),
                    excerpt = sourceExcerpt(result, data);
                  return (
                    <article className="review-preview-item" key={result.id}>
                      <span className="meta">
                        {t("검토 항목 {index} · 1차 검토", {
                          index: index + 1,
                        })}
                      </span>
                      <h4>{result.title}</h4>
                      {excerpt && (
                        <div className="review-source-block">
                          <span>{t("연결된 피드백")}</span>
                          <p>{excerpt}</p>
                        </div>
                      )}
                      <div className="review-preserved-copy">
                        <span className="meta">{t("수정한 내용")}</span>
                        <p>{result.description}</p>
                      </div>
                      {version ? (
                        <button
                          className="review-file-chip"
                          type="button"
                          onClick={() =>
                            setPreviewFile(
                              previewFile?.id === version.id ? null : version,
                            )
                          }
                        >
                          <Icon name="file" size={19} />
                          <span>
                            <strong>{version.fileName}</strong>
                            <small>
                              v{version.number} · {result.location}
                            </small>
                          </span>
                          <Icon name="chevron-down" size={16} />
                        </button>
                      ) : (
                        <p className="meta">{t("파일 없음 · 설명으로 검토")}</p>
                      )}
                    </article>
                  );
                })}
                {previewFile && (
                  <div className="review-compose-pdf">
                    <SectionBoundary resetKeys={[previewFile.id]}>
                      <PdfViewer version={previewFile} />
                    </SectionBoundary>
                  </div>
                )}
                <p className="review-inline-note">
                  <Icon name="info" size={17} />
                  {picks.some((result) => !!result.versionId)
                    ? t(
                        "볼 위치는 먼저 볼 곳을 알려 줄 뿐이에요. 교수님은 첨부한 PDF 전체를 보고 내려받을 수 있어요.",
                      )
                    : t("첨부 파일 없이 위의 설명이 공개돼요.")}
                </p>
                {error && (
                  <p className="review-form-error" role="alert">
                    {error}
                  </p>
                )}
                {isUnregisteredReviewer(error) && (
                  <div className="invite-hint">
                    <InviteLinkButton />
                    <span>
                      {t(
                        "복사한 링크를 교수님께 직접 보내 주세요. 가입한 뒤에 검토 요청을 보낼 수 있어요.",
                      )}
                    </span>
                  </div>
                )}
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setStep("compose");
                    setPreviewFile(null);
                    setError("");
                  }}
                >
                  {t("돌아가서 수정")}
                </Button>
                <Button disabled={busy} onClick={submit}>
                  {busy ? t("링크 만드는 중") : t("검토 링크 만들기")}
                  <Icon name="link" size={16} />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="student-dialog">
          <DialogHeader>
            <DialogTitle>{t("검토 요청 작성을 닫을까요?")}</DialogTitle>
            <DialogDescription>
              {t(
                "입력한 제목과 교수 계정 이메일, 수정 결과 선택이 사라져요. 수정 결과는 그대로 남아요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              {t("계속 작성")}
            </Button>
            <Button variant="destructive" onClick={close}>
              {t("버리고 닫기")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
