import type { ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorNotice } from "@/components/common";
import { t } from "@/lib/i18n";

/**
 * 화면의 한 부분(PDF 뷰어·원고 편집기·로드맵 그림)이 그리다 실패해도 나머지 화면은 그대로 쓰게 합니다.
 * 전체 화면 오류는 AppCrash(라우터)가 맡고, 여기서는 그 부분만 안내와 '다시 불러오기'로 바꿉니다.
 * `resetKeys`가 바뀌면(다른 문서를 열면) 자동으로 다시 그립니다.
 */
export function SectionBoundary({
  resetKeys,
  children,
}: {
  resetKeys?: readonly unknown[];
  children: ReactNode;
}) {
  return (
    <ErrorBoundary
      resetKeys={resetKeys ? [...resetKeys] : undefined}
      onError={(error) => {
        // 오류 이름과 메시지만 남깁니다. 연구 내용, 계정, 토큰은 적지 않습니다.
        const name = error instanceof Error ? error.name : "UnknownError";
        const message =
          error instanceof Error ? error.message.slice(0, 200) : "";
        console.error(`[margin] section crashed: ${name} ${message}`);
      }}
      fallbackRender={({ resetErrorBoundary }) => (
        <ErrorNotice
          message={t(
            "이 부분을 표시하지 못했어요. 저장한 내용은 그대로 있어요.",
          )}
          retry={resetErrorBoundary}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
