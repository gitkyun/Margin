import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "./icons";
import { Segments } from "./experience";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import "./subscription-plans.css";

const plans = [
  {
    id: "free",
    name: "Free",
    icon: "book",
    line: "내 연구를 차근차근 시작할 때",
    features: [
      "미팅 기록과 다음 미팅 준비",
      "원고 작성과 보존 버전",
      "피드백·할 일·교수 검토",
      "선택한 기록으로 AI 실행",
    ],
    note: "기록부터 검토까지, 기본 연구 공간",
  },
  {
    id: "pro",
    name: "Pro",
    icon: "sparkles",
    line: "AI와 함께 더 깊이 연구할 때",
    features: [
      "Free의 모든 기능",
      "확장된 AI 사용량",
      "긴 문서와 자료를 함께 검토",
      "심화 분석을 위한 모델 옵션",
    ],
    note: "제공 범위와 가격은 출시 시 안내합니다.",
  },
  {
    id: "team",
    name: "Team",
    icon: "users",
    line: "동료와 같은 맥락에서 일할 때",
    features: [
      "Pro의 모든 기능",
      "연구실 단위 사용량 관리",
      "구성원과 연구 공간 관리",
      "팀 운영을 위한 지원",
    ],
    note: "공동 기록은 연구에 참여자를 추가하면 사용할 수 있습니다.",
  },
];
export function SubscriptionPlans({
  publicView = false,
  signedIn = false,
}: {
  publicView?: boolean;
  signedIn?: boolean;
}) {
  const [period, setPeriod] = useState("monthly");
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
          <p>연구하는 방식에 맞춰 선택하세요.</p>
        </div>
      )}
      <div className="subscription-period">
        <Segments
          label="청구 주기"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "monthly", label: "월간" },
            { value: "yearly", label: "연간" },
          ]}
        />
      </div>
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
                  <span>/ {period === "monthly" ? "월" : "년"}</span>
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
                    ? "내 연구로"
                    : "무료로 시작하기"
                  : "내 연구로 돌아가기"}
                <Icon name="arrow-right" size={16} />
              </Link>
            ) : (
              <button
                className="subscription-button"
                onClick={() => setDetail(plan.id)}
              >
                플랜 자세히 보기
                <Icon name="arrow-up-right" size={16} />
              </button>
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
        유료 플랜은 준비 중입니다. 지금은 결제되거나 이용 권한이 변경되지
        않습니다.
      </p>
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name} 출시 예정</DialogTitle>
            <DialogDescription>{selected?.line}</DialogDescription>
          </DialogHeader>
          <p>
            현재는 플랜의 구성을 미리 살펴볼 수 있습니다. 가격과 상세 제공
            범위는 출시할 때 안내합니다.
          </p>
          <ul className="subscription-detail-list">
            {selected?.features.map((f) => (
              <li key={f}>
                <Icon name="check" size={16} />
                {f}
              </li>
            ))}
          </ul>
          <button
            className="rms-action primary"
            onClick={() => setDetail(null)}
          >
            확인
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
