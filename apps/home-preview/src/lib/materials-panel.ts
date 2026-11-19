import type { Meeting, MaterialVersion } from "@/lib/domain";

/**
 * 자료 창(IA v2 06 §5)의 [이 미팅에 가져가기]가 넣을 미팅: 지금 본문에 열어 둔 준비 중인 미팅입니다.
 * 서면 피드백·보관한 미팅·다른 연구의 미팅에는 두지 않습니다.
 */
export function takeAlongMeeting(
  pathname: string,
  meetings: Meeting[],
  researchId: string,
): Meeting | null {
  const base = `/r/${researchId}/meetings/`;
  if (!pathname.startsWith(base)) return null;
  const id = pathname.slice(base.length).split("/")[0];
  if (!id) return null;
  const meeting = meetings.find(
    (m) =>
      m.id === id &&
      m.researchId === researchId &&
      !m.archivedAt &&
      m.status === "preparing" &&
      m.recordType !== "written",
  );
  return meeting ?? null;
}

/**
 * 미팅 준비의 '보여 줄 자료'(`versionIds`)에 그 자료의 판을 넣은 미팅. 이미 들어 있으면 null.
 * 지금 준비 화면은 자료 판만 고르므로(글은 `documentIds`이지만 준비 화면에 아직 보이지 않음) 판만 넣습니다.
 */
export function withVersion(
  meeting: Meeting,
  version: Pick<MaterialVersion, "id">,
): Meeting | null {
  if (meeting.versionIds.includes(version.id)) return null;
  return { ...meeting, versionIds: [...meeting.versionIds, version.id] };
}
