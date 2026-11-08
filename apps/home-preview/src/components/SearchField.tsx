import { useRef, type ComponentProps, type Ref } from "react";
import { Icon } from "./icons";

// RMS implementation of the search/clear/refocus pattern reviewed in Compass.
// Uses existing icons and tokens; no Compass source or global stylesheet is vendored.
export function SearchField({
  value,
  onValueChange,
  inputRef,
  compact = false,
  className = "",
  onKeyDown,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "ref"> & {
  value: string;
  onValueChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  compact?: boolean;
  className?: string;
}) {
  const localRef = useRef<HTMLInputElement | null>(null);
  function clear() {
    onValueChange("");
    localRef.current?.focus();
  }
  return (
    <div
      className={`rms-search-field ${compact ? "is-compact" : ""} ${className}`}
    >
      <Icon name="search" size={compact ? 17 : 20} />
      <input
        {...props}
        type="search"
        ref={(node) => {
          localRef.current = node;
          if (typeof inputRef === "function") inputRef(node);
          else if (inputRef) inputRef.current = node;
        }}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            event.stopPropagation();
            clear();
          } else onKeyDown?.(event);
        }}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          aria-label="검색어 지우기"
          onClick={clear}
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
