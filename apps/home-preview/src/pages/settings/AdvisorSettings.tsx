import { t } from "@/lib/i18n";
import { useId, useState } from "react";
import { Icon } from "@/components/icons";
import { InlineEmpty } from "@/components/common";
import { EmailChips } from "@/components/EmailChips";
import { InviteLinkButton } from "@/components/InviteLinkButton";
import { MAX_ADVISORS } from "@/lib/advisors";

interface AdvisorSettingsProps {
  /** 이 연구에 등록된 지도교수 이메일 */
  emails: string[];
  /** 연구를 고칠 수 있는 사람만 추가·삭제할 수 있습니다. */
  canEdit: boolean;
  busy: boolean;
  onSave: (emails: string[]) => Promise<void>;
}

/**
 * 연구 설정의 지도교수 구역. 여기서 등록해 두면 검토 요청을 만들 때 고르기만 합니다.
 * 등록만으로는 교수에게 아무것도 보내지 않고, 연구 기록도 공개되지 않습니다.
 */
export function AdvisorSettings({
  emails,
  canEdit,
  busy,
  onSave,
}: AdvisorSettingsProps) {
  const [draft, setDraft] = useState("");
  const hintId = useId();
  const full = emails.length >= MAX_ADVISORS;

  return (
    <section className="settings-section advisor-section">
      <h2>{t("지도교수")}</h2>
      <p>
        {t(
          "검토 요청을 만들 때 여기 등록한 교수 중에서 골라요. 등록만으로는 교수님께 알림이 가지 않고 연구 기록도 보이지 않아요.",
        )}
      </p>
      {canEdit ? (
        <>
          {/* 저장하는 동안에는 칩을 잠가 두 번 저장하거나 입력이 사라지지 않게 해요. */}
          <fieldset disabled={busy} className="research-keyword-field">
            <EmailChips
              emails={emails}
              onChange={(next) => void onSave(next)}
              draft={draft}
              onDraftChange={setDraft}
              placeholder="professor@example.com"
              aria-label={t("지도교수 이메일")}
              aria-describedby={hintId}
            />
          </fieldset>
          <small id={hintId} className="settings-note">
            {full
              ? t("지도교수는 {max}명까지 등록할 수 있어요.", {
                  max: MAX_ADVISORS,
                })
              : t("Enter나 쉼표로 한 명씩 넣어요. 넣거나 빼면 바로 저장돼요.")}
          </small>
        </>
      ) : emails.length > 0 ? (
        <div className="member-list">
          {emails.map((email) => (
            <div key={email} className="member-row">
              <span className="avatar" aria-hidden="true">
                <Icon name="user" size={16} />
              </span>
              <div>
                <strong>{email}</strong>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <InlineEmpty>{t("아직 등록한 지도교수가 없어요.")}</InlineEmpty>
      )}
      <div className="invite-hint">
        <InviteLinkButton />
        <span>
          {t(
            "아직 마진에 가입하지 않은 교수님께는 초대 링크를 직접 보내 주세요. 가입한 이메일로만 검토 요청을 보낼 수 있어요.",
          )}
        </span>
      </div>
    </section>
  );
}
