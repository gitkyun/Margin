/**
 * 체크박스 안의 체크 표시. 완료로 바꾼 순간 선이 그려지듯 나타나요
 * (student.css의 .task-check-draw, stroke-dashoffset). 동작 줄이기면 바로 보여요.
 */
export function DrawnCheck() {
  return (
    <svg
      className="drawn-check"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12.5 9.5 17 19 7.5"
        pathLength={1}
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
