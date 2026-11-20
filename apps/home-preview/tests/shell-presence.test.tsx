// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { useCallback, useState } from "react";
import { describe, expect, it } from "vitest";
import { ShellPresence, useAnnounceShell } from "../src/lib/shell-presence";

function Shell() {
  useAnnounceShell();
  return null;
}

function Host({ shells }: { shells: number }) {
  const [count, setCount] = useState(0);
  const announce = useCallback(
    (delta: 1 | -1) => setCount((c) => c + delta),
    [],
  );
  return (
    <ShellPresence value={announce}>
      {Array.from({ length: shells }, (_, i) => (
        <Shell key={i} />
      ))}
      <output>{count}</output>
    </ShellPresence>
  );
}

describe("shell presence (IA v2 02 §7)", () => {
  it("counts mounted shells so the out-of-shell refresh notice can hide", () => {
    const view = render(<Host shells={0} />);
    const out = () => view.container.querySelector("output")?.textContent;
    expect(out()).toBe("0");
    view.rerender(<Host shells={1} />);
    expect(out()).toBe("1");
    view.rerender(<Host shells={0} />);
    expect(out()).toBe("0");
  });
});
