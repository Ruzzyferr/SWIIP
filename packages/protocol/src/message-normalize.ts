import type { MessagePayload, ReactionPayload } from './events';

/** Single Prisma `Reaction` row shape sometimes sent or cached without aggregation. */
export interface PrismaReactionRow {
  emojiId?: string | null;
  emojiName: string;
  emojiAnimated?: boolean;
  userId: string;
}

function isPrismaReactionRows(reactions: unknown[] | undefined): reactions is PrismaReactionRow[] {
  if (!reactions?.length) return false;
  const first = reactions[0] as Record<string, unknown>;
  return (
    typeof first?.emojiName === 'string' &&
    typeof first?.userId === 'string' &&
    !(
      first.emoji &&
      typeof first.emoji === 'object' &&
      typeof (first.emoji as { name?: unknown }).name === 'string'
    )
  );
}

function effectiveEmojiId(id: string | null | undefined): string {
  if (id == null || id === '') return '';
  return id;
}

/** Aggregate per-user reaction rows into `ReactionPayload[]` (same rules as API serializer). */
export function normalizeReactionsFromPrismaRows(
  reactions: PrismaReactionRow[] | undefined,
  viewerUserId: string,
): ReactionPayload[] {
  if (!reactions?.length) return [];

  const groups = new Map<
    string,
    { emojiName: string; emojiId: string; emojiAnimated: boolean; userIds: Set<string> }
  >();

  for (const r of reactions) {
    const idNorm = effectiveEmojiId(r.emojiId);
    const key = `${r.emojiName}\0${idNorm}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        emojiName: r.emojiName,
        emojiId: idNorm,
        emojiAnimated: r.emojiAnimated ?? false,
        userIds: new Set(),
      };
      groups.set(key, g);
    }
    g.userIds.add(r.userId);
  }

  return Array.from(groups.values()).map((g) => ({
    emoji:
      g.emojiId === ''
        ? { name: g.emojiName }
        : { name: g.emojiName, id: g.emojiId, animated: g.emojiAnimated },
    count: g.userIds.size,
    me: viewerUserId ? g.userIds.has(viewerUserId) : false,
  }));
}

/**
 * If `message.reactions` are legacy Prisma rows (e.g. from IndexedDB cache), convert to protocol shape.
 * Idempotent when reactions are already `ReactionPayload[]`.
 */
export function coerceMessageReactionsToProtocol(
  message: MessagePayload,
  viewerUserId: string,
): MessagePayload {
  const reactions = message.reactions as unknown[] | undefined;
  if (!reactions?.length || !isPrismaReactionRows(reactions)) {
    return message;
  }
  return {
    ...message,
    reactions: normalizeReactionsFromPrismaRows(reactions, viewerUserId),
  };
}
