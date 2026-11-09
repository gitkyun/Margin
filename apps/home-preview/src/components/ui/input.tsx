import type { ComponentProps } from "react";
import { TextField } from "@montage-ui/core";

/**
 * 마진 공통 한 줄 입력. 모양은 Montage TextField(높이 48)가 맡습니다.
 *
 * - `className`·`style`은 바깥 테두리(wrapper)에, 나머지 속성은 안쪽
 *   `<input>`에 붙습니다. 화면 CSS에서 입력 자체가 아니라 상자 배치만
 *   다룹니다.
 * - `aria-invalid`가 참이면 Montage의 오류(negative) 상태로 그립니다.
 * - 안쪽은 그대로 네이티브 `<input>`이라 FormNavigationGuard·IME 처리와
 *   폼 제출 동작이 바뀌지 않습니다.
 */
export function Input({
  ref,
  size: _size,
  fieldSize = "large",
  ...props
}: ComponentProps<"input"> & {
  /** Montage 크기: large 48px(폼 기본), medium 40px(목록 위 도구 줄) */
  fieldSize?: "large" | "medium";
}) {
  const invalid =
    props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <TextField
      ref={ref}
      size={fieldSize}
      status={invalid ? "negative" : "normal"}
      data-slot="input"
      {...(props as Record<string, unknown>)}
    />
  );
}
