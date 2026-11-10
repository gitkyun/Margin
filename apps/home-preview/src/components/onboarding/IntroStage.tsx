import { BrandMark } from "@/components/brand/Brand";
import { Icon } from "@/components/icons";
import { INTRO_FLOW } from "@/lib/intro";

interface IntroStageProps {
  slide: number;
  flowIndex: number;
}

/** 전체 화면에서 확대해 들어갈 자리(그 단계의 핵심 컴포넌트 쪽). */
const ZOOM_ORIGIN = ["18% 62%", "28% 42%", "18% 46%", "82% 60%", "28% 88%"];

const SCATTERED = [
  { icon: "calendar", label: "미팅 메모", note: "지도 미팅에서 적은 말" },
  { icon: "feedback", label: "받은 피드백", note: "고치라고 들은 내용" },
  { icon: "file", label: "고친 원고", note: "버전마다 남긴 파일" },
];

/** 단계마다 그 화면을 줄인 그림. 글은 예시이고 실제 기록이 아닙니다. */
function FlowScreen({ index }: { index: number }) {
  const example = INTRO_FLOW[index].example;
  if (index === 0)
    return (
      <div className="ob-shot-card">
        <span className="ob-shot-label">
          <Icon name="edit" size={14} />
          메모
        </span>
        <i className="ob-skel ob-skel-line ob-shot-extra" />
        <p className="ob-shot-mark ob-shot-focus">{example}</p>
        <i className="ob-skel ob-skel-short ob-shot-extra" />
      </div>
    );
  if (index === 1)
    return (
      <>
        <div className="ob-shot-card ob-shot-focus">
          <span className="ob-shot-badge">시작 전</span>
          <p>{example}</p>
        </div>
        <div className="ob-shot-card ob-shot-extra">
          <i className="ob-skel ob-skel-short" />
          <i className="ob-skel ob-skel-line" />
        </div>
      </>
    );
  if (index === 2)
    return (
      <div className="ob-shot-card">
        <p className="ob-shot-task ob-shot-focus">
          <i className="ob-shot-check" />
          {example}
        </p>
        <p className="ob-shot-task ob-shot-extra">
          <i className="ob-shot-check" />
          <i className="ob-skel ob-skel-line" />
        </p>
        <p className="ob-shot-task ob-shot-extra">
          <i className="ob-shot-check" />
          <i className="ob-skel ob-skel-short" />
        </p>
      </div>
    );
  if (index === 3)
    return (
      <div className="ob-shot-pair">
        <div className="ob-shot-card ob-shot-extra">
          <span className="ob-shot-label">바꾸기 전</span>
          <i className="ob-skel ob-skel-line" />
          <i className="ob-skel ob-skel-line" />
          <i className="ob-skel ob-skel-short" />
        </div>
        <div className="ob-shot-card ob-shot-focus">
          <span className="ob-shot-label">바꾼 뒤</span>
          <p className="ob-shot-mark">{example}</p>
        </div>
      </div>
    );
  return (
    <div className="ob-shot-card">
      <span className="ob-shot-label">
        <Icon name="send" size={14} />
        교수님께 보낸 요청
      </span>
      <p>{example}</p>
      <p className="ob-shot-reply ob-shot-focus">
        <Icon name="check-circle" size={16} />
        교수님 응답
        <span className="ob-shot-badge">수정 내용 확인</span>
      </p>
    </div>
  );
}

/**
 * 소개 오른쪽의 움직이는 장면. 실제 화면을 줄인 창 모양입니다.
 * 첫 장은 흩어진 기록이 연구 하나로 모이고, 둘째 장은 왼쪽에서 고른 단계의 화면으로 바뀝니다.
 * 설명은 왼쪽 글에 모두 있어 보조 기술에서는 숨깁니다.
 */
export function IntroStage({ slide, flowIndex }: IntroStageProps) {
  const step = INTRO_FLOW[flowIndex];
  const flow = slide === 1;
  return (
    <div className="ob-stage" aria-hidden="true" inert>
      <div className="ob-stage-rail">
        <BrandMark className="ob-rail-mark" />
        <div className="ob-stage-nav">
          {flow && (
            <i
              className="ob-stage-cursor"
              style={{ transform: `translateY(${flowIndex * 100}%)` }}
            />
          )}
          {INTRO_FLOW.map((item, index) => (
            <span
              key={item.label}
              data-state={
                !flow
                  ? undefined
                  : index === flowIndex
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
      </div>
      {flow ? (
        <div className="ob-stage-main" key="flow">
          <div
            className="ob-shot"
            key={step.label}
            style={{ transformOrigin: ZOOM_ORIGIN[flowIndex] }}
          >
            <p className="ob-shot-title">
              <Icon name={step.icon} size={18} />
              {step.label}
              <small>
                {flowIndex + 1} / {INTRO_FLOW.length}
              </small>
            </p>
            <FlowScreen index={flowIndex} />
          </div>
        </div>
      ) : (
        <div className="ob-stage-main ob-gather" key="gather">
          <p className="ob-shot-title">내 연구</p>
          {SCATTERED.map((item) => (
            <div className="ob-gather-row" key={item.label}>
              <span className="ob-intro-icon">
                <Icon name={item.icon} size={18} />
              </span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.note}</small>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
