import type { ComponentProps } from "react";
import { TextArea } from "@montage-ui/core";

/**
 * 마진 공통 여러 줄 입력. 모양은 Montage TextArea가 맡고, 내용에 맞춰
 * 높이가 늘어납니다. `rows`는 최소 줄 수(minRows)로 씁니다.
 *
 * `className`·`style`은 바깥 상자에, 나머지 속성은 안쪽 `<textarea>`에
 * 붙습니다. 미팅 원문처럼 테두리 없는 문서 영역은 이 컴포넌트 대신
 * 네이티브 `<textarea>`를 씁니다.
 */
export function Textarea({
  ref,
  rows,
  value,
  ...props
}: ComponentProps<"textarea">) {
  const invalid =
    props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <TextArea
      ref={ref}
      minRows={rows ?? 3}
      width="100%"
      value={value === undefined ? undefined : String(value)}
      status={invalid ? "negative" : "normal"}
      data-slot="textarea"
      {...(props as Record<string, unknown>)}
    />
  );
}
