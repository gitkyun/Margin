import { dateLocale } from "@/lib/i18n";
import NumberFlow from "@number-flow/react";

interface RollingNumberProps {
  value: number;
}

/**
 * 숫자가 바뀔 때 자릿수가 굴러가며 바뀝니다(@number-flow/react).
 * ‘동작 줄이기’를 켠 사용자에게는 바로 바뀝니다.
 */
export function RollingNumber({ value }: RollingNumberProps) {
  return <NumberFlow value={value} locales={dateLocale()} />;
}
