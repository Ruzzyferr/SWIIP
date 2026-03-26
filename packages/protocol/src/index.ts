/**
 * @constchat/protocol
 *
 * WebSocket gateway protocol definitions for ConstChat.
 * Shared between the client application and the gateway service.
 *
 * @example
 * import {
 *   OpCode,
 *   ClientEventType,
 *   ServerEventType,
 *   ChannelType,
 *   type GatewayEvent,
 *   type MessagePayload,
 *   type UserPayload,
 * } from '@constchat/protocol';
 */

export {
  // Enums
  OpCode,
  ChannelType,
  ClientEventType,
  ServerEventType,

  // Primitive types
  type PresenceStatus,
  type NotificationType,

  // Shared / referenced payload types
  type AttachmentRef,
  type AttachmentPayload,
  type EmojiRef,
  type ActivityPayload,
  type ActivityTimestamps,
  type UserPayload,
  type RolePayload,
  type PermissionOverwrite,
  type ChannelPayload,
  type DMChannelPayload,
  type MemberPayload,
  type GuildPayload,
  type EmbedPayload,
  type EmbedField,
  type EmbedMedia,
  type ReactionPayload,
  type MessagePayload,

  // Event unions
  type ClientEvent,
  type ServerEvent,

  // Gateway envelope types
  type GatewayEvent,
  type ServerDispatchEnvelope,
  type ClientEnvelope,
} from './events';
