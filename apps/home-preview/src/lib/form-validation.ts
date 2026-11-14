import { toast } from "sonner";
import { t } from "@/lib/i18n";

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** 칸 이름: 연결된 label의 글자(안의 입력·도움말 제외) → aria-label → placeholder 순으로 찾습니다. */
export function fieldLabel(field: Field): string {
  const label = field.labels?.[0];
  if (label) {
    const copy = label.cloneNode(true) as HTMLElement;
    copy
      .querySelectorAll(
        "input, textarea, select, small, button, [hidden], [aria-hidden='true']",
      )
      .forEach((node) => node.remove());
    // 필수 표시(*)는 이름이 아니라서 뺍니다.
    const text = copy.textContent
      ?.replace(/\s+/g, " ")
      .replace(/\s*\*\s*$/, "")
      .trim();
    if (text) return text;
  }
  const aria = field.getAttribute("aria-label");
  if (aria) return aria.trim();
  return "placeholder" in field ? field.placeholder.trim() : "";
}

/** 브라우저 검사 결과를 앱 문구로 바꿉니다. */
export function fieldMessage(field: Field): string {
  const label = fieldLabel(field);
  const v = field.validity;
  if (v.valueMissing)
    return label
      ? t("‘{label}’ 칸을 채워 주세요.", { label })
      : t("필수 칸을 채워 주세요.");
  if (v.typeMismatch && field.type === "email")
    return t("이메일 형식을 확인해 주세요.");
  if (v.tooShort && "minLength" in field)
    return t("‘{label}’ 칸에 {count}자 이상 입력해 주세요.", {
      label,
      count: field.minLength,
    });
  return t("‘{label}’ 칸의 입력값을 확인해 주세요.", { label });
}

/**
 * 브라우저 기본 말풍선("이 입력란을 작성하세요.") 대신 앱 문구로 알립니다(감사 B1).
 * 잘못된 칸은 aria-invalid로 표시하고 첫 칸으로 포커스를 옮겨요. 고치면 표시를 지웁니다.
 */
export function installFormValidation(root: Document = document): () => void {
  let reported = false;
  const onInvalid = (event: Event) => {
    const field = event.target as Field;
    event.preventDefault();
    field.setAttribute("aria-invalid", "true");
    // 한 번 제출에 invalid가 칸마다 나므로 첫 칸만 알립니다.
    if (reported) return;
    reported = true;
    queueMicrotask(() => {
      reported = false;
    });
    field.focus();
    toast.error(fieldMessage(field));
  };
  const onInput = (event: Event) => {
    const field = event.target as Field;
    if (
      field.getAttribute?.("aria-invalid") === "true" &&
      field.validity?.valid
    )
      field.removeAttribute("aria-invalid");
  };
  root.addEventListener("invalid", onInvalid, true);
  root.addEventListener("input", onInput, true);
  return () => {
    root.removeEventListener("invalid", onInvalid, true);
    root.removeEventListener("input", onInput, true);
  };
}
