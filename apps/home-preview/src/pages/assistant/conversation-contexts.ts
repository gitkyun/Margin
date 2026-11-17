import type { AIContext, AIConversationMessage } from "@/lib/domain";

const keyOf = (context: AIContext) =>
  `${context.kind}:${context.id}:${context.page ?? ""}`;

/** Restore the failed request's attachments without replacing new selections. */
export function restorePendingContexts(
  current: AIContext[],
  sent: AIContext[],
): AIContext[] {
  const present = new Set(current.map(keyOf));
  return [
    ...current,
    ...sent.filter((context) => !present.has(keyOf(context))),
  ];
}

/** Legacy conversations only stored their first message's files on the conversation. */
export function messageFileContexts(
  messages: AIConversationMessage[],
  index: number,
  legacy: AIContext[],
): AIContext[] {
  const message = messages[index];
  if (!message || message.role !== "user") return [];
  const contexts =
    message.contexts ??
    (index === messages.findIndex((item) => item.role === "user")
      ? legacy
      : []);
  return contexts.filter(
    (context) => context.kind === "attachments" || context.kind === "versions",
  );
}
