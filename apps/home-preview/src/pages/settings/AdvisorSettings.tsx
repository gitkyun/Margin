import { useState } from "react";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_ADVISORS, addAdvisor, isEmail } from "@/lib/advisors";

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
  const [problem, setProblem] = useState("");
  const full = emails.length >= MAX_ADVISORS;

  async function add() {
    const value = draft.trim();
    if (!isEmail(value)) {
      setProblem("이메일 형식을 확인해 주세요.");
      return;
    }
    const next = addAdvisor(emails, value);
    if (next === emails) {
      setProblem("이미 등록한 이메일이에요.");
      return;
    }
    setProblem("");
    await onSave(next);
    setDraft("");
  }

  return (
    <section className="settings-section advisor-section">
      <h2>지도교수</h2>
      <p>
        검토 요청을 만들 때 여기 등록한 교수 중에서 골라요. 등록만으로는
        교수님께 알림이 가지 않고 연구 기록도 보이지 않아요.
      </p>
      {emails.length > 0 ? (
        <div className="member-list">
          {emails.map((email) => (
            <div key={email} className="member-row">
              <span className="avatar" aria-hidden="true">
                <Icon name="user" size={16} />
              </span>
              <div>
                <strong>{email}</strong>
              </div>
              {canEdit && (
                <IconButton
                  label={`${email} 등록 해제`}
                  onClick={() => {
                    if (busy) return;
                    void onSave(emails.filter((item) => item !== email));
                  }}
                >
                  <Icon name="close" size={16} />
                </IconButton>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="student-empty-inline">아직 등록한 지도교수가 없어요.</p>
      )}
      {canEdit && !full && (
        <form
          className="advisor-add"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <Input
            aria-label="지도교수 이메일"
            type="email"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setProblem("");
            }}
            placeholder="professor@example.com"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={busy || !draft.trim()}
          >
            추가
          </Button>
        </form>
      )}
      {problem && (
        <p className="rms-error" role="alert">
          {problem}
        </p>
      )}
      {full && <p>지도교수는 {MAX_ADVISORS}명까지 등록할 수 있어요.</p>}
    </section>
  );
}
