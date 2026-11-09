import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Icon } from "@/components/icons";
import { queryUp } from "@/design/responsive";

export type WorkflowStep = {
  label: string;
  icon: string;
  title: string;
  body: string;
  color: string;
};

/** public-site.css의 .lp-stack-card top·gap과 같은 값 */
const STACK_TOP = 96;
const STACK_STEP = 18;
const STACK_GAP = 40;

const STACK_QUERY = `${queryUp("md")} and (prefers-reduced-motion: no-preference)`;

/** md 이상이고 동작 줄이기를 쓰지 않을 때만 스크롤 스택으로 보여 줍니다. */
export function useStackedWorkflow() {
  const [enabled, setEnabled] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia(STACK_QUERY).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(STACK_QUERY);
    const update = () => setEnabled(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return enabled;
}

/**
 * 소개 화면 ‘이렇게 사용해요’의 넓은 화면 버전.
 * 왼쪽 단계 목록은 화면에 붙어 있고, 오른쪽 카드가 스크롤에 따라 한 장씩 위로 쌓입니다.
 * 지금 보이는 카드가 왼쪽 목록의 현재 단계가 되고, 단계를 누르면 그 카드로 이동합니다.
 */
export function WorkflowStack({
  steps,
  renderPreview,
}: {
  steps: readonly WorkflowStep[];
  renderPreview: (index: number) => ReactNode;
}) {
  const [active, setActive] = useState(0);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const stack = useRef<HTMLDivElement>(null);

  // 붙어 있는 카드는 모두 화면 안에 있으므로, 화면 가운데를 넘어 올라온
  // 마지막 카드를 현재 단계로 봅니다.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const middle = window.innerHeight * 0.5;
      const reached = cards.current.reduce(
        (last, card, i) =>
          card && card.getBoundingClientRect().top < middle ? i : last,
        0,
      );
      setActive(reached);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [steps.length]);

  return (
    <section className="lp-workflow lp-workflow-stack" id="workflow">
      <div className="lp-workflow-select">
        <div className="lp-stack-rail">
          <h2>이렇게 사용해요</h2>
          <div role="group" aria-label="기능별 사용 방법">
            {steps.map((step, i) => (
              <button
                key={step.label}
                type="button"
                aria-pressed={active === i}
                onClick={() => {
                  const card = cards.current[i];
                  const list = stack.current;
                  if (!card || !list) return;
                  // 붙은 카드는 현재 위치가 아닌 원래 흐름 위치로 계산해야
                  // 앞 카드들이 순서대로 쌓인 상태로 도착합니다.
                  const listTop = list.getBoundingClientRect().top + scrollY;
                  const step = card.offsetHeight + STACK_GAP;
                  window.scrollTo({
                    top: listTop + i * step - (STACK_TOP + i * STACK_STEP),
                    behavior: "smooth",
                  });
                }}
              >
                <span className="lp-stack-index" aria-hidden="true">
                  {i + 1}
                </span>
                <Icon name={step.icon} size={22} />
                {step.label}
              </button>
            ))}
          </div>
          <div className="lp-stack-progress" aria-hidden="true">
            <span
              style={{ transform: `scaleX(${(active + 1) / steps.length})` }}
            />
          </div>
          <p>
            직접 쓰든 AI 제안을 선택하든
            <br />
            기록은 같은 연구에 남아요.
          </p>
        </div>
      </div>
      <div className="lp-stack-cards" ref={stack}>
        {steps.map((step, i) => (
          <article
            key={step.label}
            ref={(node) => {
              cards.current[i] = node;
            }}
            data-step={i}
            className={`lp-stack-card lp-tone-${step.color}`}
            style={{ "--stack-index": i } as CSSProperties}
          >
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            <div className="lp-stack-preview">{renderPreview(i)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
