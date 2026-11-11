import { useEffect } from "react";
import { useRouteError } from "react-router-dom";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/**
 * 화면을 그리다 예외가 났을 때 흰 화면 대신 보여 주는 안내(라우터 errorElement).
 * 저장된 기록은 서버(미리보기는 이 브라우저)에 있으므로 새로고침하면 다시 볼 수 있습니다.
 */
export function AppCrash() {
  const error = useRouteError();
  useEffect(() => {
    // 오류 이름과 메시지만 남깁니다. 연구 내용, 계정, 토큰은 적지 않습니다.
    const name = error instanceof Error ? error.name : "UnknownError";
    const message = error instanceof Error ? error.message.slice(0, 200) : "";
    console.error(`[margin] screen crashed: ${name} ${message}`);
  }, [error]);
  return (
    <div className="connection-error" role="alert">
      <Icon name="warning" size={30} />
      <h1>{t("화면을 표시하지 못했어요")}</h1>
      <p>
        {t(
          "저장한 기록은 그대로 있어요. 새로고침해도 같은 문제가 계속되면 admin@margin.com으로 알려 주세요.",
        )}
      </p>
      <Button onClick={() => window.location.reload()}>{t("새로고침")}</Button>
      <Button variant="outline" onClick={() => window.location.assign("/r")}>
        {t("내 연구로 이동")}
      </Button>
    </div>
  );
}
