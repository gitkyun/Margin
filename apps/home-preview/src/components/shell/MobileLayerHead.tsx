import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Icon } from "../icons";
import { Segments } from "../experience";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { LayerSegment } from "@/lib/side-panel";

export type AssistantView = "chat" | "suggestions" | "runs";

/**
 * 휴대폰 층의 머리(02 §6, D16): `연구 도우미 | 결정·질문 | 자료` 세그먼트와,
 * 연구 도우미일 때 오른쪽 [⋯](대화 | 제안 | 실행 내역). 탐색이 세 겹으로 쌓이지 않게 창 안의 보기 줄 대신 씁니다.
 * 닫기(×)는 두지 않습니다. 아래 탭의 '연구 도우미'를 다시 누르거나 뒤로 가기로 닫습니다.
 */
export function MobileLayerHead({
  segment,
  onSegment,
  assistantView,
  pending,
  onAssistantView,
}: {
  segment: LayerSegment;
  onSegment(segment: LayerSegment): void;
  assistantView: AssistantView;
  /** 확인할 AI 제안 수. 있으면 [⋯]에 점을 붙입니다. */
  pending: number;
  onAssistantView(view: AssistantView): void;
}) {
  return (
    <div className="ia-layer-head">
      {/* 세그먼트는 폭을 채우므로 남는 폭만 쓰도록 감쌉니다([⋯] 자리를 남김). */}
      <div className="ia-layer-segments">
        <Segments
          value={segment}
          onChange={(value) => onSegment(value as LayerSegment)}
          label={t("옆 창 보기")}
          size="small"
          fill
          options={[
            { value: "assistant", label: t("연구 도우미") },
            { value: "log", label: t("결정·질문") },
            { value: "materials", label: t("자료") },
          ]}
        />
      </div>
      {segment === "assistant" && (
        <DropdownMenu value={assistantView}>
          <DropdownMenuTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ia-layer-more"
              aria-label={
                pending
                  ? t("연구 도우미 보기, 확인할 제안 {count}개", {
                      count: pending,
                    })
                  : t("연구 도우미 보기")
              }
              aria-haspopup="menu"
            >
              <Icon name="more" size={18} />
              {pending > 0 && <span className="ia-layer-dot" aria-hidden />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              value="chat"
              onSelect={() => onAssistantView("chat")}
            >
              {t("대화")}
            </DropdownMenuItem>
            <DropdownMenuItem
              value="suggestions"
              onSelect={() => onAssistantView("suggestions")}
            >
              {pending ? t("제안 {count}개", { count: pending }) : t("제안")}
            </DropdownMenuItem>
            <DropdownMenuItem
              value="runs"
              onSelect={() => onAssistantView("runs")}
            >
              {t("실행 내역")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
