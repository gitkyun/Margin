import { t } from "@/lib/i18n";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { resetTourSeen } from "@/lib/tour";

/**
 * 사용 안내의 ‘다시 보기’. 서비스 소개는 바로 열고, 화면 안내는 연구 홈에서만 뜨기 때문에
 * 봤다는 기록을 지운 뒤 내 연구로 보냅니다. 로그인한 사람에게만 보여 줍니다.
 */
export function GuideReplay() {
  return (
    <section className="guide-replay" aria-labelledby="guide-replay-heading">
      <h2 id="guide-replay-heading">{t("처음 본 안내 다시 보기")}</h2>
      <p>
        {t("화면 안내는 내 연구에서 연구를 하나 열면 연구 홈에 다시 나와요.")}
      </p>
      <div className="guide-replay-actions">
        <Button asChild variant="outline">
          <Link to="/r/new?intro=1">
            <Icon name="book" size={18} />
            {t("서비스 소개 다시 보기")}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/r" onClick={resetTourSeen}>
            <Icon name="eye" size={18} />
            {t("화면 안내 다시 보기")}
          </Link>
        </Button>
      </div>
    </section>
  );
}
