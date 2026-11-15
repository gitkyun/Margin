import { t } from "@/lib/i18n";
import { useMemo } from "react";
import { useWorkspace } from "@/lib/workspace";
import {
  formatBytes,
  monthlyAIUsage,
  seoulMonthKey,
  storageScale,
  storageUsage,
} from "@/lib/usage-meters";
import "./account-settings.css";

/**
 * 계정 설정 › 사용량: 이번 달 AI 실행 요청 수와 내가 올린 파일의 저장 공간.
 * 둘 다 워크스페이스에 이미 있는 실제 기록으로만 계산하고, 없는 값은 지어내지 않아요.
 * 플랜별 저장 한도는 아직 없어서 게이지는 500MB 눈금으로 쓴 양만 보여 줍니다.
 */
export function UsageMeters() {
  const { data, user, mode } = useWorkspace();
  const month = seoulMonthKey(new Date());
  const ai = useMemo(
    () => monthlyAIUsage(data.aiRuns, user.id, month),
    [data.aiRuns, user.id, month],
  );
  const storage = useMemo(() => storageUsage(data, user.id), [data, user.id]);
  const scale = storageScale(storage.bytes);
  const [year, monthNumber] = month.split("-");
  return (
    <>
      <section className="settings-section">
        <h2>{t("이번 달 AI 사용량")}</h2>
        <p>
          {t("{year}년 {month}월(한국 시간) 동안 내가 실행한 요청 수예요.", {
            year,
            month: Number(monthNumber),
          })}
        </p>
        {mode === "preview" ? (
          <p className="inline-notice">
            {t("미리보기에서는 AI를 실행할 수 없어 사용량을 세지 않아요.")}
          </p>
        ) : (
          <div className="usage-summary">
            <div>
              <span>{t("실행 요청")}</span>
              <strong>{ai.total}</strong>
            </div>
            <div>
              <span>{t("성공")}</span>
              <strong>{ai.complete}</strong>
            </div>
            <div>
              <span>{t("실패")}</span>
              <strong>{ai.failed}</strong>
            </div>
          </div>
        )}
        <p className="settings-note">
          {t(
            "지금 열 수 있는 연구에서 실행한 요청만 세요. 월간 한도는 없고, 최근 24시간 한도만 있어요.",
          )}
        </p>
      </section>
      <section className="settings-section">
        <h2>{t("저장 공간")}</h2>
        <p>
          {t("내가 소유한 연구에 올린 자료·녹음·첨부 파일의 크기를 더했어요.")}
        </p>
        {storage.files === 0 ? (
          <p className="inline-notice">{t("아직 올린 파일이 없어요.")}</p>
        ) : (
          <div className="storage-meter">
            <p className="storage-meter-value">
              <strong>{formatBytes(storage.bytes)}</strong>
              <small>{t("파일 {count}개", { count: storage.files })}</small>
            </p>
            <div
              className="storage-meter-track"
              role="meter"
              aria-label={t("저장 공간 사용량")}
              aria-valuemin={0}
              aria-valuemax={scale.max}
              aria-valuenow={storage.bytes}
              aria-valuetext={t("{used} 사용, 눈금 {max}", {
                used: formatBytes(storage.bytes),
                max: formatBytes(scale.max),
              })}
            >
              <span
                className="storage-meter-fill"
                style={{
                  width: `${Math.min(100, (storage.bytes / scale.max) * 100)}%`,
                }}
              />
              {scale.ticks.slice(0, -1).map((tick) => (
                <i
                  key={tick}
                  className="storage-meter-tick"
                  style={{ left: `${(tick / scale.max) * 100}%` }}
                />
              ))}
            </div>
            <div className="storage-meter-scale" aria-hidden="true">
              <span>0</span>
              {scale.ticks.map((tick) => (
                <span
                  key={tick}
                  style={{ left: `${(tick / scale.max) * 100}%` }}
                >
                  {formatBytes(tick)}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="settings-note">
          {t(
            "검토 요청에 붙인 PDF처럼 크기가 기록되지 않은 파일은 빠져요. 플랜별 저장 한도는 아직 정하지 않아 눈금은 500MB 단위로만 보여요.",
          )}
        </p>
      </section>
    </>
  );
}
