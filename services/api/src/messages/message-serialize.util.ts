/**
 * Serialize Prisma message rows to client / @constchat/protocol shape
 * (author avatar, aggregated reactions with `emoji`, `count`, `me`).
 */

import type { MessagePayload } from '@constchat/protocol';
import { coerceMessageReactionsToProtocol } from '@constchat/protocol';

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

  out = coerceMessageReactionsToProtocol(out as MessagePayload, viewerUserId);

  return out;
}
