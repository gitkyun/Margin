import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { t } from "@/lib/i18n";
import { useExperience } from "@/lib/experience";
import { uid, type MeetingPoll } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icons";
import { useDisabledReason } from "@/components/common";
import { DateTimeField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** 시간 조율 후보는 이 개수까지 넣을 수 있어요. */
const POLL_OPTION_LIMIT = 12;

/** `?new=poll`이면 true(01 §3.3) */
export function newPollRequest(search: string): boolean {
  return new URLSearchParams(search).get("new") === "poll";
}

/** 창을 연 뒤 주소에서 `new=poll`을 지운 검색어. 다른 값(보기)은 남깁니다. */
export function withoutNewPoll(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("new");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * 어느 화면에서든 미팅 시간 조율 창을 그 자리에서 엽니다(01 §3.3 `new=poll`).
 * 미팅 목록의 기록 추가 메뉴와 시간 조율 보기가 이 주소를 씁니다. 만들면 그 조율 화면(`/schedule/:id`)으로 갑니다.
 */
export function PollCreateHost({ researchId }: { researchId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [at, setAt] = useState<number | null>(null);
  useEffect(() => {
    if (!newPollRequest(location.search)) return;
    setAt(Date.now());
    navigate(
      {
        pathname: location.pathname,
        search: withoutNewPoll(location.search),
        hash: location.hash,
      },
      { replace: true, state: location.state },
    );
  }, [location.search, researchId]);
  if (at === null) return null;
  return (
    <PollCreate
      key={at}
      open
      onClose={() => setAt(null)}
      researchId={researchId}
    />
  );
}

export function PollCreate({
  open,
  onClose,
  researchId,
}: {
  open: boolean;
  onClose: () => void;
  researchId: string;
}) {
  const { action } = useExperience(),
    navigate = useNavigate(),
    [title, setTitle] = useState(""),
    [emails, setEmails] = useState(""),
    [options, setOptions] = useState([{ id: uid(), start: "", end: "" }]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const optionLimitReason = useDisabledReason(
    options.length >= POLL_OPTION_LIMIT &&
      t("후보 시간은 {count}개까지 넣을 수 있어요.", {
        count: POLL_OPTION_LIMIT,
      }),
  );
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="rms-dialog">
        <DialogHeader>
          <DialogTitle>{t("미팅 시간 조율")}</DialogTitle>
          <DialogDescription>
            {t(
              "입력한 계정에 마진 알림을 보내요. 이메일은 보내지 않아요. 공동연구자가 아닌 사람에게는 연구 이름, 미팅 제목, 후보 시간, 참여자별 응답만 보여요.",
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const p = await action<MeetingPoll>("rms_poll_action", {
                action: "create",
                researchId,
                title,
                emails: emails.split(/[,;\s]+/).filter(Boolean),
                options: options.map((o) => ({
                  ...o,
                  start: new Date(o.start).toISOString(),
                  end: new Date(o.end).toISOString(),
                })),
              });
              onClose();
              navigate(`/schedule/${p.id}`);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <DialogBody>
            <label className="field">
              {t("미팅 제목")}
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
              />
            </label>
            <label className="field">
              {t("참석자 이메일")}
              <Input
                required
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder={t("쉼표로 구분해 입력")}
              />
              <small>
                {t(
                  "마진 계정이 있는 사람만 초대할 수 있어요. 이메일은 최대 20개예요.",
                )}
              </small>
            </label>
            {options.map((o, i) => (
              <div className="schedule-option-input" key={o.id}>
                <strong>{t("후보 {n}", { n: i + 1 })}</strong>
                <div className="schedule-option-field">
                  <span>{t("시작")}</span>
                  <DateTimeField
                    label={t("후보 {n} 시작", { n: i + 1 })}
                    required
                    value={o.start}
                    onChange={(startValue) =>
                      setOptions(
                        options.map((v) =>
                          v.id === o.id ? { ...v, start: startValue } : v,
                        ),
                      )
                    }
                  />
                </div>
                <div className="schedule-option-field">
                  <span>{t("종료")}</span>
                  <DateTimeField
                    label={t("후보 {n} 종료", { n: i + 1 })}
                    required
                    value={o.end}
                    onChange={(endValue) =>
                      setOptions(
                        options.map((v) =>
                          v.id === o.id ? { ...v, end: endValue } : v,
                        ),
                      )
                    }
                  />
                </div>
                {options.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setOptions(options.filter((v) => v.id !== o.id))
                    }
                  >
                    {t("후보 제거")}
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={options.length >= POLL_OPTION_LIMIT}
              aria-describedby={optionLimitReason.describedBy}
              onClick={() =>
                setOptions([...options, { id: uid(), start: "", end: "" }])
              }
            >
              <Icon name="plus" size={16} />
              {t("후보 추가")}
            </Button>
            {optionLimitReason.node}
            {error && <p className="rms-error">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              {t("취소")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t("보내는 중") : t("응답 요청 보내기")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
