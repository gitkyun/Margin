// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MaterialUploadField } from "../src/pages/student/MaterialUploadField";
import { useFileDrop } from "../src/lib/use-file-drop";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = () => {};
});

afterEach(cleanup);

function createDataTransfer(files: File[]) {
  const items = files.map((file) => ({
    kind: "file",
    type: file.type,
    getAsFile: () => file,
    webkitGetAsEntry: () => null,
  }));
  return {
    files,
    items,
    types: ["Files"],
  };
}

describe("react-dropzone 파일 끌어놓기", () => {
  it("(a) PDF를 놓으면 onSelect가 호출됨", async () => {
    const onSelect = vi.fn();
    const onClear = vi.fn();
    const onAbort = vi.fn();

    render(
      <MaterialUploadField
        file={null}
        busy={false}
        progress={null}
        pending={false}
        onSelect={onSelect}
        onClear={onClear}
        onAbort={onAbort}
      />,
    );

    const dropzone = screen.getByRole("button", {
      name: /여기에 PDF를 끌어다 놓아 주세요/i,
    });
    expect(dropzone).toBeDefined();

    const pdfFile = new File(["%PDF-1.4 test"], "document.pdf", {
      type: "application/pdf",
    });

    fireEvent.drop(dropzone, {
      dataTransfer: createDataTransfer([pdfFile]),
    });

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(pdfFile);
    });
  });

  it("(b) PDF가 아닌 파일을 놓으면 호출되지 않고 오류 문구가 보임", async () => {
    const onSelect = vi.fn();
    const onClear = vi.fn();
    const onAbort = vi.fn();

    render(
      <MaterialUploadField
        file={null}
        busy={false}
        progress={null}
        pending={false}
        onSelect={onSelect}
        onClear={onClear}
        onAbort={onAbort}
      />,
    );

    const dropzone = screen.getByRole("button", {
      name: /여기에 PDF를 끌어다 놓아 주세요/i,
    });

    const textFile = new File(["hello world"], "notes.txt", {
      type: "text/plain",
    });

    fireEvent.drop(dropzone, {
      dataTransfer: createDataTransfer([textFile]),
    });

    await waitFor(() => {
      expect(onSelect).not.toHaveBeenCalled();
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("PDF 파일만 올릴 수 있어요.");
    });
  });

  it("연구 도우미 첨부(assistant): PDF, TXT, MD 외의 파일을 놓으면 오류 문구를 알림", async () => {
    function AssistantDropTest() {
      const [error, setError] = React.useState("");
      const onSelect = vi.fn();
      const { getRootProps, getInputProps } = useFileDrop({
        kind: "assistant",
        accept: {
          "application/pdf": [".pdf"],
          "text/plain": [".txt"],
          "text/markdown": [".md"],
        },
        onSelect,
        onError: setError,
      });

      return (
        <div {...getRootProps()} data-testid="assistant-dropzone">
          <input {...getInputProps()} />
          {error && <p role="alert">{error}</p>}
        </div>
      );
    }

    render(<AssistantDropTest />);
    const dropzone = screen.getByTestId("assistant-dropzone");

    const pngFile = new File(["fake png"], "image.png", {
      type: "image/png",
    });

    fireEvent.drop(dropzone, {
      dataTransfer: createDataTransfer([pngFile]),
    });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain(
        "PDF, TXT, MD 파일만 첨부할 수 있어요.",
      );
    });
  });

  it("파일 선택 후 동일한 파일을 다시 선택할 수 있도록 input value가 초기화됨", () => {
    function ResetInputTest() {
      const onSelect = vi.fn();
      const { getInputProps } = useFileDrop({ onSelect });
      return <input data-testid="file-input" {...getInputProps()} />;
    }

    render(<ResetInputTest />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;

    // input에 값이 설정되어 있어도 클릭 시 value = ""가 됨
    Object.defineProperty(input, "value", {
      writable: true,
      value: "C:\\fakepath\\document.pdf",
    });
    expect(input.value).toBe("C:\\fakepath\\document.pdf");

    fireEvent.click(input);
    expect(input.value).toBe("");
  });
});
