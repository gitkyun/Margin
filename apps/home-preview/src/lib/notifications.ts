import { t } from "@/lib/i18n";
import { keepParticle } from "@/lib/keep-particle";
import type {
  AppUser,
  ReviewRequest,
  ReviewRound,
  WorkspaceData,
} from "./domain";

import {
  reviewPermissions,
  type ReviewPermissions,
} from "./review-permissions";

export interface ReviewNotification {
  id: string;
  kind: "response" | "comment" | "round";
  requestId: string;
  researchId: string;
  roundId: string;
  itemId: string;
  roundNumber: number;
  title: string;
  message: string;
  excerpt?: string;
  tone: "amber" | "green" | "blue";
  createdAt: string;
}

/** Uses only the caller's authorized workspace records; reads never imply review. */
export function unreadReviewNotifications(
  data: WorkspaceData,
  user: AppUser,
  researchId?: string,
): ReviewNotification[] {
  if (user.preferences?.review === false) return [];
  const permitted = new Map<
    string,
    { request: ReviewRequest; permissions: ReviewPermissions }
  >();
  for (const request of data.reviews) {
    if (researchId && request.researchId !== researchId) continue;
    const permissions = reviewPermissions(data, request, user.id);
    if (permissions.canRead) permitted.set(request.id, { request, permissions });
  }
  const notifications: ReviewNotification[] = [];
  const add = (
    round: ReviewRound,
    details: Pick<
      ReviewNotification,
      "id" | "kind" | "message" | "excerpt" | "tone" | "createdAt"
    >,
  ) => {
    const permittedRequest = permitted.get(round.requestId);
    if (!permittedRequest) return;
    const lastSeen = data.reads.find(
      (read) => read.roundId === round.id && read.userId === user.id,
    )?.lastSeenAt;
    const time = Date.parse(details.createdAt);
    if (!Number.isFinite(time) || (lastSeen && Date.parse(lastSeen) >= time))
      return;
    notifications.push({
      ...details,
      requestId: round.requestId,
      researchId: permittedRequest.request.researchId,
      roundId: round.id,
      itemId: round.itemId,
      roundNumber: round.number,
      title: round.title,
    });
  };
  for (const round of data.rounds) {
    const entry = permitted.get(round.requestId);
    if (!entry) continue;
    if (
      entry.permissions.canRespondOnLatestRound &&
      round.createdBy !== user.id
    )
      add(round, {
        id: `round:${round.id}`,
        kind: "round",
        message:
          round.number > 1
            ? t("다시 확인을 요청한 수정 결과가 있어요.")
            : t("검토할 수정 결과가 있어요."),
        tone: "blue",
        createdAt: round.createdAt,
      });
    if (entry.permissions.canEditResearch) {
      for (const response of data.responses.filter(
        (r) => r.roundId === round.id && r.userId !== user.id,
      ))
        add(round, {
          id: `response:${response.id}`,
          kind: "response",
          message:
            response.result === "changes_requested"
              ? keepParticle(t("교수님이 ‘추가 수정 필요’를 남겼어요."))
              : keepParticle(t("교수님이 ‘수정 내용 확인’을 남겼어요.")),
          excerpt: response.comment || undefined,
          tone: response.result === "changes_requested" ? "amber" : "green",
          createdAt: response.updatedAt,
        });
    }
    for (const comment of data.comments.filter(
      (c) => c.roundId === round.id && c.userId !== user.id,
    ))
      add(round, {
        id: `comment:${comment.id}`,
        kind: "comment",
        message: comment.parentId
          ? t("{name}님이 답글을 남겼어요.", {
              name: comment.authorName || t("검토 참여자"),
            })
          : t("{name}님이 댓글을 남겼어요.", {
              name: comment.authorName || t("검토 참여자"),
            }),
        excerpt: comment.body,
        tone: "blue",
        createdAt: comment.createdAt,
      });
  }
  return notifications.sort(
    (a, b) =>
      Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

export function notificationHref(event: ReviewNotification): string {
  return `/reviews/${event.requestId}?item=${event.itemId}&round=${event.roundId}`;
}

export function activityEnabled(
  event: WorkspaceData["events"][number],
  user: AppUser,
  data: WorkspaceData,
): boolean {
  const key =
    event.kind === "schedule"
      ? "schedule"
      : event.kind === "review"
        ? "review"
        : event.href.includes("/tasks/")
          ? "assignment"
          : "collaboration";
  return user.preferences?.[key] !== false;
}
