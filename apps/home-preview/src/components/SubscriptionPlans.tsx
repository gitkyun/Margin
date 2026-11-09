import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import "./subscription-plans.css";
import { Button } from "@/components/ui/button";

const plans = [
  {
    id: "free",
    name: "Free",
    icon: "book",
    line: "논문 지도 기록을 시작할 때",
    features: [
      "미팅 기록과 다음 미팅 준비",
      "원고 작성과 버전 비교",
      "피드백·할 일·교수 검토",
      "선택한 기록으로 AI 실행",
    ],
    note: "미팅 기록부터 교수 검토까지 기본 기능을 모두 담았어요.",
  },
  {
    id: "pro",
    name: "Pro",
    icon: "sparkles",
    line: "AI를 더 많이 쓰고 싶을 때",
    features: [
      "Free의 모든 기능",
      "더 많은 AI 사용량",
      "AI로 긴 문서와 자료 함께 읽기",
      "깊은 분석용 AI 모델 선택",
    ],
    note: "가격과 제공 범위는 출시할 때 안내할게요.",
  },
  {
    id: "team",
    name: "Team",
    icon: "users",
    line: "연구실 단위로 관리할 때",
    features: [
      "Pro의 모든 기능",
      "연구실 단위 사용량 관리",
      "구성원과 연구 공간 관리",
      "팀 운영 지원",
    ],
    note: "공동 기록은 Team이 아니어도 공동연구자를 초대하면 쓸 수 있어요.",
  },
];
export function SubscriptionPlans({
  publicView = false,
  signedIn = false,
}: {
  publicView?: boolean;
  signedIn?: boolean;
}) {
  const [detail, setDetail] = useState<string | null>(null);
  const selected = plans.find((p) => p.id === detail);
  return (
    <section
      className={`subscription-plans ${publicView ? "subscription-public" : ""}`}
      aria-label="구독 플랜 비교"
    >
      {!publicView && (
        <div className="subscription-heading">
          <h2>플랜</h2>
          <p>플랜별 제공 기능을 비교할 수 있어요.</p>
        </div>
      )}
      <div className="subscription-grid">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`subscription-card subscription-${plan.id}`}
          >
            <div className="subscription-card-top">
              <span className="subscription-icon">
                <Icon name={plan.icon} size={22} />
              </span>
              <span className="subscription-status">
                {plan.id === "free" ? "기본 플랜" : "출시 예정"}
              </span>
            </div>
            <h3>{plan.name}</h3>
            <p className="subscription-line">{plan.line}</p>
            <div className="subscription-price">
              {plan.id === "free" ? (
                <>
                  <strong>₩0</strong>
                  <span>/ 월</span>
                </>
              ) : (
                <strong className="subscription-coming">출시 예정</strong>
              )}
            </div>
            {plan.id === "free" ? (
              <Link
                className="subscription-button subscription-button-primary"
                to={publicView ? (signedIn ? "/r" : "/signup") : "/r"}
              >
                {publicView
                  ? signedIn
                    ? "내 연구 열기"
                    : "가입 과정 미리보기"
                  : "내 연구로 돌아가기"}
                <Icon name="arrow-right" size={16} />
              </Link>
            ) : (
              <Button variant="link" onClick={() => setDetail(plan.id)}>
                플랜 자세히 보기
                <Icon name="chevron-right" size={16} />
              </Button>
            )}
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Icon name="check" size={16} />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="subscription-note">{plan.note}</p>
          </article>
        ))}
      </div>
      <p className="subscription-disclosure">
        유료 플랜은 준비 중이에요. 지금은 결제되지 않고, 이용 권한도 바뀌지
        않아요.
      </p>
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name} 출시 예정</DialogTitle>
            <DialogDescription>{selected?.line}</DialogDescription>
          </DialogHeader>
          <p>
            지금은 플랜 구성만 미리 볼 수 있어요. 가격과 자세한 제공 범위는
            출시할 때 안내할게요.
          </p>
          <ul className="subscription-detail-list">
            {selected?.features.map((f) => (
              <li key={f}>
                <Icon name="check" size={16} />
                {f}
              </li>
            ))}
          </ul>
          <Button onClick={() => setDetail(null)}>닫기</Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
