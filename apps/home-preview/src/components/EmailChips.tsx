import { t } from "@/lib/i18n";
import { addAdvisor, isEmail, MAX_ADVISORS } from "@/lib/advisors";
import { TagChips } from "@/components/TagChips";

interface EmailChipsProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  /** 아직 칩이 되지 않은 입력. 다음 단계로 갈 때 함께 넣을 수 있게 밖에 둡니다. */
  draft: string;
  onDraftChange: (draft: string) => void;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const SEPARATOR = /[\s,;]+/;

/**
 * 지도교수 이메일 칩 입력. Enter·쉼표·띄어쓰기·붙여넣기로 칩을 만들고, 빈 칸에서 ⌫로 마지막 칩을 지워요.
 * 칩 동작은 TagChips가 맡고, 여기서는 이메일 규칙(소문자·겹침 없음·최대 5명)만 정합니다.
 */
export function EmailChips({ emails, ...props }: EmailChipsProps) {
  return (
    <TagChips
      {...props}
      values={emails}
      add={addAdvisor}
      isValid={isEmail}
      max={MAX_ADVISORS}
      separator={SEPARATOR}
      inputMode="email"
      fullNote={t("{count}명까지 등록할 수 있어요.", { count: MAX_ADVISORS })}
      invalidMessage={t("이메일 주소 형식을 확인해 주세요.")}
    />
  );
}
