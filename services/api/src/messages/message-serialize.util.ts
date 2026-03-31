/**
 * Serialize Prisma message rows to client / @constchat/protocol shape
 * (author avatar, aggregated reactions with `emoji`, `count`, `me`).
 */

export interface PrismaReactionRow {
  emojiId?: string | null;
  emojiName: string;
  emojiAnimated?: boolean;
  userId: string;
}

function effectiveEmojiId(id: string | null | undefined): string {
  if (id == null || id === '') return '';
  return id;
}

function isPrismaReactionRows(
  reactions: unknown[] | undefined,
): reactions is PrismaReactionRow[] {
  if (!reactions?.length) return false;
  const first = reactions[0] as Record<string, unknown>;
  return typeof first?.emojiName === 'string' && typeof first?.userId === 'string' && !('emoji' in first);
}

/** Aggregate per-user reaction rows into protocol ReactionPayload[]. */
export function normalizeReactionsFromPrisma(
  reactions: PrismaReactionRow[] | undefined,
  viewerUserId: string,
): { emoji: { name: string; id?: string; animated?: boolean }; count: number; me: boolean }[] {
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

export function mapMessageForClient(msg: any, viewerUserId: string): any {
  if (!msg) return msg;

  let out = { ...msg };

  if (out.author) {
    const { avatarId, ...rest } = out.author;
    out = { ...out, author: { ...rest, avatar: avatarId ?? null } };
  }

  if (out.referencedMessage?.author) {
    const { avatarId, ...rest } = out.referencedMessage.author;
    out = {
      ...out,
      referencedMessage: {
        ...out.referencedMessage,
        author: { ...rest, avatar: avatarId ?? null },
      },
    };
  }

  if (isPrismaReactionRows(out.reactions)) {
    out = {
      ...out,
      reactions: normalizeReactionsFromPrisma(out.reactions, viewerUserId),
    };
  }

  return out;
}
