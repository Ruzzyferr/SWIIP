/**
 * Serialize Prisma message rows to client / @constchat/protocol shape
 * (author avatar, aggregated reactions with `emoji`, `count`, `me`).
 */

import type { MessagePayload } from '@constchat/protocol';
import { coerceMessageReactionsToProtocol } from '@constchat/protocol';

type AuthorLike = { avatarId?: string | null } & Record<string, unknown>;

type MessageRowLike = Record<string, unknown> & {
  author?: AuthorLike;
  referencedMessage?: (Record<string, unknown> & { author?: AuthorLike }) | null;
};

export function mapMessageForClient(
  msg: MessageRowLike | null | undefined,
  viewerUserId: string,
): MessagePayload | null | undefined {
  if (msg == null) return msg;

  let out: MessageRowLike = { ...msg };

  if (out.author) {
    const { avatarId, ...rest } = out.author;
    out = { ...out, author: { ...rest, avatar: avatarId ?? null } };
  }

  const ref = out.referencedMessage;
  if (ref?.author) {
    const { avatarId, ...rest } = ref.author;
    out = {
      ...out,
      referencedMessage: {
        ...ref,
        author: { ...rest, avatar: avatarId ?? null },
      },
    };
  }

  return coerceMessageReactionsToProtocol(out as unknown as MessagePayload, viewerUserId);
}
