import {
  Children,
  forwardRef,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Button as MontageButton,
  IconButton,
  TextButton,
} from "@montage-ui/core";

/**
 * 마진 공통 버튼. 모양은 모두 Montage 4.2.0 컴포넌트가 맡습니다.
 *
 * | variant      | Montage                                  |
 * |--------------|------------------------------------------|
 * | default      | Button solid · primary                    |
 * | secondary    | Button solid · assistive                  |
 * | outline      | Button outlined · assistive               |
 * | destructive  | Button solid · negative                   |
 * | ghost        | TextButton · assistive                    |
 * | link         | TextButton · primary                      |
 * | size=icon*   | IconButton (ghost → normal, outline → outlined, 그 밖 → solid) |
 *
 * | size            | Montage                     |
 * |-----------------|-----------------------------|
 * | xs              | xsmall (28)                 |
 * | sm              | small (32)                  |
 * | default         | medium (40)                 |
 * | lg              | large (48)                  |
 *
 * `asChild`는 자식 요소(예: react-router Link)를 Montage의 `as`로 넘겨
 * 버튼 모양의 링크를 만듭니다. `data-slot="button"`은 화면 배치용 선택자로만
 * 남깁니다. 이 속성으로 색·크기·모서리를 다시 덮지 않습니다.
 */
export type ButtonVariant =
  "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
export type ButtonSize =
  "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

export type ButtonProps = Omit<ComponentPropsWithoutRef<"button">, "color"> & {
  asChild?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /**
   * 부모 너비를 꽉 채웁니다(Montage fullWidth). 버튼 너비는 CSS 대신 이 값으로 정합니다.
   * "mobile"은 768px 아래에서만, "desktop"은 992px 이상에서만 채웁니다.
   */
  fullWidth?: boolean | "mobile" | "desktop";
};

const BUTTON_SIZE = {
  xs: "xsmall",
  sm: "small",
  default: "medium",
  lg: "large",
} as const;

const ICON_SIZE = {
  "icon-xs": "small",
  "icon-sm": "medium",
  icon: "large",
  "icon-lg": "xlarge",
} as const;

function resolveAs(asChild: boolean, children: ReactNode) {
  if (!asChild) return { as: undefined, content: children, childProps: {} };
  const child = Children.only(children) as ReactElement<{
    children?: ReactNode;
  }>;
  if (!isValidElement(child)) {
    return { as: undefined, content: children, childProps: {} };
  }
  const { children: content, ...childProps } = child.props;
  return { as: child.type as ElementType, content, childProps };
}

/**
 * 글자 앞뒤의 아이콘 요소를 Montage의 leadingContent·trailingContent로 옮깁니다.
 * (Montage는 글자를 span 하나로 감싸므로 아이콘을 그 안에 두면 줄이 바뀝니다.)
 */
function splitIcons(content: ReactNode) {
  const items = Children.toArray(content);
  const isText = (item: ReactNode) =>
    typeof item === "string" || typeof item === "number";
  if (items.length < 2 || !items.some(isText)) {
    return { leading: undefined, body: content, trailing: undefined };
  }
  const leading = isValidElement(items[0]) ? items.shift() : undefined;
  const trailing =
    items.length > 1 && isValidElement(items[items.length - 1])
      ? items.pop()
      : undefined;
  return { leading, body: items, trailing };
}

/** Montage 반응형 속성은 모바일 우선(min-width)입니다. */
function fullWidthProps(fullWidth: ButtonProps["fullWidth"]) {
  if (fullWidth === "mobile")
    return { fullWidth: true, sm: { fullWidth: false } };
  if (fullWidth === "desktop")
    return { fullWidth: false, md: { fullWidth: true } };
  return { fullWidth: fullWidth ?? false };
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "default",
      size = "default",
      asChild = false,
      fullWidth,
      children,
      ...props
    },
    ref,
  ) {
    const { as, content, childProps } = resolveAs(asChild, children);
    const link = as !== undefined;
    const shared = {
      ...childProps,
      ...props,
      ref,
      as,
      "data-slot": "button",
      "data-variant": variant,
      "data-size": size,
      // 링크로 그릴 때 button 전용 type 속성을 남기지 않습니다.
      ...(link ? { type: undefined } : {}),
      // Montage는 이름을 안쪽 글자(aria-labelledby)로 정합니다.
      // 호출부가 aria-label을 주면 그 이름을 그대로 씁니다.
      ...(props["aria-label"] ? { "aria-labelledby": undefined } : {}),
    } as Record<string, unknown>;

    if (size.startsWith("icon")) {
      return (
        <IconButton
          {...shared}
          variant={
            variant === "ghost" || variant === "link"
              ? "normal"
              : variant === "outline"
                ? "outlined"
                : "solid"
          }
          size={ICON_SIZE[size as keyof typeof ICON_SIZE]}
        >
          {content}
        </IconButton>
      );
    }

    const montageSize = BUTTON_SIZE[size as keyof typeof BUTTON_SIZE];
    const { leading, body, trailing } = splitIcons(content);
    const slots = { leadingContent: leading, trailingContent: trailing };
    if (variant === "ghost" || variant === "link") {
      return (
        <TextButton
          {...shared}
          {...slots}
          color={variant === "link" ? "primary" : "assistive"}
          size={
            montageSize === "small" || montageSize === "xsmall"
              ? "small"
              : "medium"
          }
        >
          {body}
        </TextButton>
      );
    }

    return (
      <MontageButton
        {...shared}
        {...slots}
        {...fullWidthProps(fullWidth)}
        size={montageSize}
        variant={variant === "outline" ? "outlined" : "solid"}
        color={
          variant === "destructive"
            ? "negative"
            : variant === "default"
              ? "primary"
              : "assistive"
        }
      >
        {body}
      </MontageButton>
    );
  },
);
