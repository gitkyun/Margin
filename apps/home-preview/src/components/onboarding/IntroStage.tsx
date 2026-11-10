import { BrandMark } from "@/components/brand/Brand";
import { Icon } from "@/components/icons";
import { INTRO_FLOW } from "@/lib/intro";

interface IntroStageProps {
  slide: number;
  flowIndex: number;
}

const SCATTERED = [
  { icon: "calendar", label: "미팅 메모" },
  { icon: "feedback", label: "받은 피드백" },
  { icon: "file", label: "고친 원고" },
];

/**
 * 소개 오른쪽의 움직이는 장면. 첫 장은 흩어진 기록이 연구 하나로 모이고,
 * 둘째 장은 왼쪽에서 고른 단계까지 선이 이어지며 예시가 바뀝니다.
 * 설명은 왼쪽 글에 모두 있어 보조 기술에서는 숨깁니다.
 */
export function IntroStage({ slide, flowIndex }: IntroStageProps) {
  const step = INTRO_FLOW[flowIndex];
  return (
    <div className="ob-stage" aria-hidden="true" inert>
      {slide === 0 ? (
        <div className="ob-gather" key="gather">
          <div className="ob-gather-home">
            <span className="ob-gather-title">
              <BrandMark className="ob-rail-mark" />내 연구
            </span>
            {SCATTERED.map((item) => (
              <span className="ob-gather-row" key={item.label}>
                <Icon name={item.icon} size={16} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="ob-flowstage" key="flow">
          <div className="ob-track">
            <span className="ob-track-line">
              <i
                style={{
                  transform: `scaleX(${flowIndex / (INTRO_FLOW.length - 1)})`,
                }}
              />
            </span>
            {INTRO_FLOW.map((item, index) => (
              <span
                className="ob-node"
                key={item.label}
                data-state={
                  index === flowIndex
                    ? "active"
                    : index < flowIndex
                      ? "done"
                      : undefined
                }
              >
                <Icon name={item.icon} size={18} />
              </span>
            ))}
          </div>
          <div className="ob-flowcard" key={step.label}>
            <strong>
              {flowIndex + 1}. {step.label}
            </strong>
            <span>{step.example}</span>
          </div>
        </div>
      )}
    </div>
  );
}
