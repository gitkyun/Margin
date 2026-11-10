import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { INTRO_FLOW, INTRO_SLIDE_COUNT } from "@/lib/intro";
import { StepMeter } from "./StepMeter";

interface ServiceIntroProps {
  /** 끝까지 봤거나 건너뛰었을 때. 이어서 연구 만들기 질문이 나옵니다. */
  onDone(): void;
}

const TITLES = [
  "마진에 오신 걸 환영해요",
  "미팅에서 검토 요청까지 이어져요",
  "이제 첫 연구를 만들어요",
];

/**
 * 처음 온 사람에게 보여 주는 서비스 소개 세 장. 연구 만들기 질문 앞에 한 번 나오고
 * 어느 장에서든 건너뛸 수 있습니다. 아무것도 저장하지 않습니다.
 */
export function ServiceIntro({ onDone }: ServiceIntroProps) {
  const [slide, setSlide] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const last = slide === INTRO_SLIDE_COUNT - 1;

  // 장을 넘기면 새 제목으로 초점을 옮겨 화면 낭독기가 바뀐 내용을 읽게 합니다.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [slide]);

  function go(next: number) {
    moved.current = true;
    setDirection(next > slide ? "forward" : "back");
    setSlide(next);
  }

  return (
    <section className="ob-form ob-intro" aria-labelledby="ob-intro-heading">
      <StepMeter count={INTRO_SLIDE_COUNT} current={slide} />
      <div className="ob-step" data-dir={direction} key={slide}>
        <p className="ob-progress">
          소개 {slide + 1} / {INTRO_SLIDE_COUNT}
        </p>
        <h1 id="ob-intro-heading" ref={heading} tabIndex={-1}>
          {TITLES[slide]}
        </h1>
        {slide === 0 && (
          <>
            <p className="ob-intro-slogan">
              흩어진 기록을 모아, 다음 연구가 되도록
            </p>
            <p className="ob-help">
              지도 미팅에서 나온 말, 받은 피드백, 고친 원고를 연구 하나에 모아
              둬요. 다음 미팅 전에 무엇을 고쳤고 무엇이 남았는지 바로 볼 수
              있어요.
            </p>
          </>
        )}
        {slide === 1 && (
          <>
            <p className="ob-help">
              기록이 다음 단계로 이어져요. 필요한 단계부터 써도 돼요.
            </p>
            <ol className="ob-intro-flow">
              {INTRO_FLOW.map((step) => (
                <li key={step.label}>
                  <span className="ob-intro-icon" aria-hidden="true">
                    <Icon name={step.icon} size={18} />
                  </span>
                  <span className="ob-intro-copy">
                    <strong>{step.label}</strong>
                    <span>{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
        {slide === 2 && (
          <p className="ob-help">
            질문 네 개에 답하면 연구 홈이 채워져요. 연구 이름만 적고 나머지는
            건너뛰어도 되고, 답한 내용은 나중에 모두 바꿀 수 있어요.
          </p>
        )}
      </div>
      <div className="ob-actions">
        <Button
          type="button"
          size="lg"
          onClick={last ? onDone : () => go(slide + 1)}
        >
          {last ? "연구 만들기" : "다음"}
          <Icon name="arrow-right" size={18} />
        </Button>
        {slide > 0 && (
          <button
            type="button"
            className="ob-skip"
            onClick={() => go(slide - 1)}
          >
            이전
          </button>
        )}
        {!last && (
          <button type="button" className="ob-skip" onClick={onDone}>
            소개 건너뛰기
          </button>
        )}
      </div>
    </section>
  );
}
