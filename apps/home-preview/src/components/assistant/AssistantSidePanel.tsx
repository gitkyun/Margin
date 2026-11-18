import { lazy, Suspense } from "react";
import { t } from "@/lib/i18n";
import type { PanelRequest } from "@/lib/side-panel";
import "./assistant-side-panel.css";

// 연구 도우미 화면은 크고(입력창·모델·명령·첨부) 처음 화면에는 필요 없어서, 창을 열 때 불러옵니다.
const ResearchAssistant = lazy(() =>
  import("@/pages/ResearchAssistant").then((m) => ({
    default: m.ResearchAssistant,
  })),
);

/**
 * 아이콘 줄의 연구 도우미 탭(IA v2 06 §2.1). 화면을 옮기지 않고 이 창 안에서 묻고 답합니다.
 * 대화·입력창·모델·명령·첨부는 연구 도우미 화면과 같은 부품(Kokonut 원본)을 그대로 씁니다.
 * '지금 보는 기록' 칩은 연구 도우미가 창 안에서 저절로 놓습니다(06 §2.2).
 */
export function AssistantSidePanel({
  researchId,
  request,
  onClose,
}: {
  researchId: string;
  /** 주소(`?panel=assistant&panelView=…`)로 열 때 보여 줄 보기. `at`이 바뀔 때마다 그 보기로 엽니다. */
  request?: (PanelRequest & { at: number }) | null;
  onClose(): void;
}) {
  return (
    <section
      className="assistant-side-panel"
      aria-label={t("연구 도우미")}
      data-research={researchId}
    >
      <Suspense
        fallback={
          <p className="assistant-side-loading" role="status">
            {t("연구 도우미를 불러오고 있어요.")}
          </p>
        }
      >
        <ResearchAssistant
          variant="panel"
          onClose={onClose}
          openView={
            request
              ? { view: request.view ?? "chat", at: request.at }
              : undefined
          }
        />
      </Suspense>
    </section>
  );
}
