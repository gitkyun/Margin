import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// 창(교수 계정 확인·공개 미리보기·PDF 보기)과 그 스타일은 처음 열 때 불러옵니다.
const ReviewComposeDialog = lazy(() =>
  import("./ReviewComposeDialog").then((m) => ({
    default: m.ReviewComposeDialog,
  })),
);

/** `?new=review&result=a,b` → 골라 둘 수정 결과. 아니면 null */
export function newReviewRequest(search: string): string[] | null {
  const params = new URLSearchParams(search);
  if (params.get("new") !== "review") return null;
  return (params.get("result") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** 창을 연 뒤 주소에서 `new=review`와 `result`를 지운 검색어 */
export function withoutNewReview(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("new");
  params.delete("result");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * 어느 화면에서든 검토 요청 만들기 창을 그 자리에서 엽니다(01 §3.3 `new=review`).
 * ⌘K '검토 요청 만들기', 미팅 목록의 기록 추가 메뉴와 수정 결과 구획, 항목 상세의 [검토 요청 만들기]가 이 주소를 씁니다.
 * 링크를 만들면 그 검토 화면(`/reviews/:id`)으로 가서 교수님께 직접 전달합니다(링크 생성 ≠ 전송).
 */
export function ReviewCreateHost({ researchId }: { researchId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [request, setRequest] = useState<{ ids: string[]; at: number } | null>(
    null,
  );
  useEffect(() => {
    const ids = newReviewRequest(location.search);
    if (!ids) return;
    setRequest({ ids, at: Date.now() });
    navigate(
      {
        pathname: location.pathname,
        search: withoutNewReview(location.search),
        hash: location.hash,
      },
      { replace: true, state: location.state },
    );
  }, [location.search, researchId]);
  if (!request) return null;
  return (
    <Suspense fallback={null}>
      <ReviewComposeDialog
        key={request.at}
        researchId={researchId}
        open
        initialResultIds={request.ids}
        onClose={() => setRequest(null)}
        onWriteResult={() =>
          navigate({ pathname: location.pathname, search: "?new=result" })
        }
      />
    </Suspense>
  );
}
