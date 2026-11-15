import { useCallback } from "react";
import {
  ErrorCode,
  useDropzone,
  type Accept,
  type DropzoneInputProps,
  type DropzoneRootProps,
  type FileRejection,
} from "react-dropzone";
import { MAX_UPLOAD_BYTES } from "@/lib/file-storage";
import { t } from "@/lib/i18n";

export const PDF_ACCEPT: Accept = {
  "application/pdf": [".pdf"],
};

export const ASSISTANT_ACCEPT: Accept = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/markdown": [".md"],
};

export interface UseFileDropOptions {
  accept?: Accept;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  noClick?: boolean;
  noKeyboard?: boolean;
  kind?: "pdf" | "assistant";
  onSelect: (file: File) => void;
  onError?: (message: string) => void;
}

export function useFileDrop({
  accept = PDF_ACCEPT,
  maxFiles = 1,
  maxSize = MAX_UPLOAD_BYTES,
  disabled = false,
  noClick = false,
  noKeyboard = false,
  kind = "pdf",
  onSelect,
  onError,
}: UseFileDropOptions) {
  const handleDropAccepted = useCallback(
    (files: File[]) => {
      onError?.("");
      if (files[0]) {
        onSelect(files[0]);
      }
    },
    [onError, onSelect],
  );

  const handleDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      const code = rejections[0]?.errors[0]?.code;
      if (code === ErrorCode.FileInvalidType) {
        onError?.(
          kind === "assistant"
            ? t("PDF, TXT, MD 파일만 첨부할 수 있어요.")
            : t("PDF 파일만 올릴 수 있어요."),
        );
      } else if (code === ErrorCode.TooManyFiles) {
        onError?.(
          kind === "assistant"
            ? t("한 번에 파일 한 개만 첨부할 수 있어요.")
            : t("한 번에 파일 한 개만 올릴 수 있어요."),
        );
      } else if (code === ErrorCode.FileTooLarge) {
        onError?.(t("500MB 이하의 파일만 올릴 수 있어요."));
      } else if (code === ErrorCode.FileTooSmall) {
        onError?.(t("빈 파일은 올릴 수 없어요."));
      } else {
        onError?.(
          kind === "assistant"
            ? t("PDF, TXT, MD 파일만 첨부할 수 있어요.")
            : t("PDF 파일을 선택해 주세요."),
        );
      }
    },
    [kind, onError],
  );

  const dropzone = useDropzone({
    accept,
    maxFiles,
    maxSize,
    multiple: maxFiles > 1,
    disabled,
    noClick,
    noKeyboard,
    onDropAccepted: handleDropAccepted,
    onDropRejected: handleDropRejected,
  });

  const getInputProps = useCallback(
    <T extends DropzoneInputProps>(props?: T): T =>
      dropzone.getInputProps({
        ...props,
        onClick: (event: React.MouseEvent<HTMLInputElement>) => {
          (event.target as HTMLInputElement).value = "";
          props?.onClick?.(event);
        },
      } as T),
    [dropzone],
  );

  return {
    ...dropzone,
    getInputProps,
  };
}
