/**
 * ConstChat Gateway Protocol
 *
 * Defines every WebSocket event exchanged between clients and the gateway
 * service. Follows a discriminated union pattern — every event carries an
 * `op` (opcode) and a `d` (data) payload keyed by the event type `t`.
 *
 * Client → Server events are namespaced under `ClientEventType`.
 * Server → Client events are namespaced under `ServerEventType`.
 *
 * The top-level `GatewayEvent` union covers both directions and is suitable
 * for switch/case dispatch in both client and server code.
 */

// ---------------------------------------------------------------------------
// Opcodes
// ---------------------------------------------------------------------------

export enum OpCode {
  /** Server is dispatching an event to the client. */
  DISPATCH = 0,
  /** Client must send a heartbeat. Server acknowledges with HEARTBEAT_ACK. */
  HEARTBEAT = 1,
  /** Client identifies itself after the initial TCP handshake. */
  IDENTIFY = 2,
  /** Client updates its own presence. */
  PRESENCE_UPDATE = 3,
  /** Client updates its own voice state. */
  VOICE_STATE_UPDATE = 4,
  /** Client requests a session resume after disconnect. */
  RESUME = 6,
  /** Server instructs client to reconnect. */
  RECONNECT = 7,
  /** Client requests offline guild members. */
  REQUEST_GUILD_MEMBERS = 8,
  /** Server indicates the session is invalid. */
  INVALID_SESSION = 9,
  /** First message sent by the server after TCP handshake. */
  HELLO = 10,
  /** Server acknowledges a client heartbeat. */
  HEARTBEAT_ACK = 11,
}

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export enum ChannelType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  CATEGORY = 'CATEGORY',
  DM = 'DM',
  GROUP_DM = 'GROUP_DM',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  STAGE = 'STAGE',
  FORUM = 'FORUM',
  THREAD = 'THREAD',
}

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'offline' | 'invisible';

export type NotificationType =
  | 'mention'
  | 'reply'
  | 'dm'
  | 'friend_request'
  | 'system';

// ---------------------------------------------------------------------------
// Shared / referenced types
// ---------------------------------------------------------------------------

export interface AttachmentRef {
  /** Original filename supplied by the uploader. */
  filename: string;
  /** File size in bytes. */
  size: number;
  /** MIME type, e.g. "image/png". */
  contentType: string;
  /** ID returned by the media service during a pre-upload request. */
  uploadId?: string;
}

export interface EmojiRef {
  /** Unicode character or short name for custom emojis. */
  name: string;
  /** Snowflake ID — only present for custom guild emojis. */
  id?: string;
  /** Whether the custom emoji is animated (GIF). */
  animated?: boolean;
}

export interface ActivityTimestamps {
  start?: number;
  end?: number;
}

export interface ActivityPayload {
  name: string;
  /** 0 = Playing, 1 = Streaming, 2 = Listening, 3 = Watching, 5 = Competing */
  type: 0 | 1 | 2 | 3 | 5;
  url?: string;
  details?: string;
  state?: string;
  timestamps?: ActivityTimestamps;
}

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface UserPayload {
  id: string;
  username: string;
  /** Zero-padded 4-digit discriminator, or "0" for pomelo users. */
  discriminator: string;
  email?: string;
  /** CDN hash for the user's avatar. */
  avatar?: string | null;
  /** CDN hash for the user's profile banner. */
  banner?: string | null;
  bio?: string | null;
  /** Display name overriding username in the UI. */
  globalName?: string | null;
  /** ISO 8601 timestamp. */
  createdAt: string;
  /** Bitfield of UserFlags. */
  flags: number;
  /** Whether the user's email has been verified. */
  verified?: boolean;
}

export interface RolePayload {
  id: string;
  guildId: string;
  name: string;
  /** Packed RGB integer (0xRRGGBB). 0 means default role color. */
  color: number;
  /** Whether members with this role are displayed separately in the sidebar. */
  hoist: boolean;
  position: number;
  /** Stringified permission bitfield. */
  permissions: string;
  mentionable: boolean;
  /** Whether this role is managed by an integration. */
  managed: boolean;
  /** CDN hash for a custom role icon. */
  icon?: string | null;
}

export interface PermissionOverwrite {
  id: string;
  /** "role" | "member" */
  type: 'role' | 'member';
  allow: string;
  deny: string;
}

export interface ChannelPayload {
  id: string;
  guildId?: string;
  type: ChannelType;
  name: string;
  position: number;
  topic?: string | null;
  parentId?: string | null;
  permissionOverwrites?: PermissionOverwrite[];
  isNsfw?: boolean;
  /** Message slowmode in seconds. */
  slowmode?: number;
  lastMessageId?: string | null;
  /** Voice channel: max concurrent listeners (0 = unlimited). */
  userLimit?: number;
  /** Voice channel: bitrate in bits per second. */
  bitrate?: number;
}

export interface DMChannelPayload {
  id: string;
  type: ChannelType.DM | ChannelType.GROUP_DM;
  recipients: UserPayload[];
  lastMessageId?: string | null;
  /** Group DM name. */
  name?: string | null;
  /** Group DM icon CDN hash. */
  icon?: string | null;
}

export interface MemberPayload {
  userId: string;
  guildId: string;
  nick?: string | null;
  /** Guild-specific avatar CDN hash. */
  avatar?: string | null;
  roles: string[];
  /** ISO 8601 timestamp. */
  joinedAt: string;
  /** ISO 8601 timestamp — when the member started boosting. */
  premiumSince?: string | null;
  /** Whether the member has not yet passed membership screening. */
  pending?: boolean;
  deaf: boolean;
  mute: boolean;
  user: UserPayload;
}

export interface GuildPayload {
  id: string;
  name: string;
  /** CDN hash. */
  icon?: string | null;
  description?: string | null;
  ownerId: string;
  memberCount: number;
  channels: ChannelPayload[];
  roles: RolePayload[];
  members: MemberPayload[];
  /** True when the guild data is not yet available (outage / lazy load). */
  unavailable?: boolean;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedMedia {
  url: string;
  proxyUrl?: string;
  width?: number;
  height?: number;
}

export interface EmbedPayload {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  thumbnail?: EmbedMedia;
  image?: EmbedMedia;
  video?: EmbedMedia;
  fields?: EmbedField[];
  footer?: { text: string; iconUrl?: string };
  author?: { name: string; url?: string; iconUrl?: string };
}

export interface AttachmentPayload {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  url: string;
  proxyUrl: string;
  width?: number;
  height?: number;
  /** Duration in seconds for audio/video attachments. */
  duration?: number;
}

export interface ReactionPayload {
  emoji: EmojiRef;
  count: number;
  /** Whether the current authenticated user has reacted with this emoji. */
  me: boolean;
}

export interface MessagePayload {
  id: string;
  channelId: string;
  guildId?: string;
  author: UserPayload;
  content: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** ISO 8601 timestamp — null if never edited. */
  editedTimestamp?: string | null;
  reactions?: ReactionPayload[];
  attachments?: AttachmentPayload[];
  embeds?: EmbedPayload[];
  /** Users @mentioned in the message body. */
  mentions?: UserPayload[];
  /** Role IDs @mentioned in the message body. */
  roleMentions?: string[];
  referencedMessage?: MessagePayload | null;
  thread?: ChannelPayload | null;
  pinned: boolean;
  /** Bitfield of MessageFlags. */
  flags: number;
  /** Random string set by the sender to deduplicate messages. */
  nonce?: string;
}

// ---------------------------------------------------------------------------
// Client → Server event types
// ---------------------------------------------------------------------------

export enum ClientEventType {
  AUTHENTICATE = 'AUTHENTICATE',
  HEARTBEAT = 'HEARTBEAT',
  IDENTIFY = 'IDENTIFY',
  SUBSCRIBE_GUILD = 'SUBSCRIBE_GUILD',
  UNSUBSCRIBE_GUILD = 'UNSUBSCRIBE_GUILD',
  MESSAGE_CREATE = 'MESSAGE_CREATE',
  MESSAGE_UPDATE = 'MESSAGE_UPDATE',
  MESSAGE_DELETE = 'MESSAGE_DELETE',
  REACTION_ADD = 'REACTION_ADD',
  REACTION_REMOVE = 'REACTION_REMOVE',
  TYPING_START = 'TYPING_START',
  PRESENCE_UPDATE = 'PRESENCE_UPDATE',
  VOICE_JOIN = 'VOICE_JOIN',
  VOICE_LEAVE = 'VOICE_LEAVE',
  VOICE_STATE_UPDATE = 'VOICE_STATE_UPDATE',
  READ_STATE_UPDATE = 'READ_STATE_UPDATE',
  GUILD_MEMBER_UPDATE = 'GUILD_MEMBER_UPDATE',
  REQUEST_GUILD_MEMBERS = 'REQUEST_GUILD_MEMBERS',
  RESUME = 'RESUME',
}

// Discriminated union of all client → server payloads
export type ClientEvent =
  | { t: ClientEventType.AUTHENTICATE; d: { token: string } }
  | { t: ClientEventType.HEARTBEAT; d: Record<string, never> }
  | {
      t: ClientEventType.IDENTIFY;
      d: {
        properties: {
          os: string;
          browser: string;
          device: string;
        };
        compress?: boolean;
        largeThreshold?: number;
      };
    }
  | { t: ClientEventType.SUBSCRIBE_GUILD; d: { guildId: string } }
  | { t: ClientEventType.UNSUBSCRIBE_GUILD; d: { guildId: string } }
  | {
      t: ClientEventType.MESSAGE_CREATE;
      d: {
        channelId: string;
        content: string;
        nonce?: string;
        replyToId?: string;
        attachments?: AttachmentRef[];
      };
    }
  | {
      t: ClientEventType.MESSAGE_UPDATE;
      d: { messageId: string; channelId: string; content: string };
    }
  | {
      t: ClientEventType.MESSAGE_DELETE;
      d: { messageId: string; channelId: string };
    }
  | {
      t: ClientEventType.REACTION_ADD;
      d: { messageId: string; channelId: string; emoji: EmojiRef };
    }
  | {
      t: ClientEventType.REACTION_REMOVE;
      d: { messageId: string; channelId: string; emoji: EmojiRef };
    }
  | { t: ClientEventType.TYPING_START; d: { channelId: string } }
  | {
      t: ClientEventType.PRESENCE_UPDATE;
      d: { status: PresenceStatus; customStatus?: string };
    }
  | { t: ClientEventType.VOICE_JOIN; d: { channelId: string } }
  | { t: ClientEventType.VOICE_LEAVE; d: Record<string, never> }
  | {
      t: ClientEventType.VOICE_STATE_UPDATE;
      d: { selfMute: boolean; selfDeaf: boolean };
    }
  | {
      t: ClientEventType.READ_STATE_UPDATE;
      d: { channelId: string; lastReadMessageId: string };
    }
  | {
      t: ClientEventType.GUILD_MEMBER_UPDATE;
      d: { guildId: string; nick?: string; avatarId?: string };
    }
  | {
      t: ClientEventType.REQUEST_GUILD_MEMBERS;
      d: { guildId: string; query?: string; limit?: number };
    }
  | {
      t: ClientEventType.RESUME;
      d: { token: string; sessionId: string; seq: number };
    };

// ---------------------------------------------------------------------------
// Server → Client event types
// ---------------------------------------------------------------------------

export enum ServerEventType {
  HELLO = 'HELLO',
  READY = 'READY',
  RESUMED = 'RESUMED',
  HEARTBEAT_ACK = 'HEARTBEAT_ACK',
  INVALID_SESSION = 'INVALID_SESSION',
  MESSAGE_CREATE = 'MESSAGE_CREATE',
  MESSAGE_UPDATE = 'MESSAGE_UPDATE',
  MESSAGE_DELETE = 'MESSAGE_DELETE',
  TYPING_START = 'TYPING_START',
  PRESENCE_UPDATE = 'PRESENCE_UPDATE',
  GUILD_CREATE = 'GUILD_CREATE',
  GUILD_UPDATE = 'GUILD_UPDATE',
  GUILD_DELETE = 'GUILD_DELETE',
  GUILD_MEMBER_ADD = 'GUILD_MEMBER_ADD',
  GUILD_MEMBER_REMOVE = 'GUILD_MEMBER_REMOVE',
  GUILD_MEMBER_UPDATE = 'GUILD_MEMBER_UPDATE',
  CHANNEL_CREATE = 'CHANNEL_CREATE',
  CHANNEL_UPDATE = 'CHANNEL_UPDATE',
  CHANNEL_DELETE = 'CHANNEL_DELETE',
  REACTION_ADD = 'REACTION_ADD',
  REACTION_REMOVE = 'REACTION_REMOVE',
  VOICE_STATE_UPDATE = 'VOICE_STATE_UPDATE',
  VOICE_SERVER_UPDATE = 'VOICE_SERVER_UPDATE',
  READ_STATE_UPDATE = 'READ_STATE_UPDATE',
  NOTIFICATION = 'NOTIFICATION',
  ERROR = 'ERROR',
}

// Discriminated union of all server → client payloads
export type ServerEvent =
  | {
      t: ServerEventType.HELLO;
      d: { heartbeatInterval: number; sessionId: string };
    }
  | {
      t: ServerEventType.READY;
      d: {
        user: UserPayload;
        guilds: GuildPayload[];
        dms: DMChannelPayload[];
        sessionId: string;
        resumeUrl: string;
      };
    }
  | { t: ServerEventType.RESUMED; d: Record<string, never> }
  | { t: ServerEventType.HEARTBEAT_ACK; d: Record<string, never> }
  | { t: ServerEventType.INVALID_SESSION; d: { resumable: boolean } }
  | { t: ServerEventType.MESSAGE_CREATE; d: { message: MessagePayload } }
  | {
      t: ServerEventType.MESSAGE_UPDATE;
      d: Partial<MessagePayload> & { id: string; channelId: string };
    }
  | {
      t: ServerEventType.MESSAGE_DELETE;
      d: { messageId: string; channelId: string; guildId?: string };
    }
  | {
      t: ServerEventType.TYPING_START;
      d: {
        channelId: string;
        userId: string;
        /** Unix ms timestamp. */
        timestamp: number;
        guildId?: string;
      };
    }
  | {
      t: ServerEventType.PRESENCE_UPDATE;
      d: {
        userId: string;
        status: PresenceStatus;
        customStatus?: string;
        activities?: ActivityPayload[];
      };
    }
  | { t: ServerEventType.GUILD_CREATE; d: { guild: GuildPayload } }
  | {
      t: ServerEventType.GUILD_UPDATE;
      d: Partial<GuildPayload> & { id: string };
    }
  | { t: ServerEventType.GUILD_DELETE; d: { guildId: string; unavailable?: boolean } }
  | { t: ServerEventType.GUILD_MEMBER_ADD; d: { guildId: string; member: MemberPayload } }
  | { t: ServerEventType.GUILD_MEMBER_REMOVE; d: { guildId: string; userId: string } }
  | {
      t: ServerEventType.GUILD_MEMBER_UPDATE;
      d: { guildId: string; member: Partial<MemberPayload> & { userId: string } };
    }
  | { t: ServerEventType.CHANNEL_CREATE; d: { channel: ChannelPayload } }
  | {
      t: ServerEventType.CHANNEL_UPDATE;
      d: Partial<ChannelPayload> & { id: string };
    }
  | { t: ServerEventType.CHANNEL_DELETE; d: { channelId: string; guildId?: string } }
  | {
      t: ServerEventType.REACTION_ADD;
      d: {
        messageId: string;
        channelId: string;
        userId: string;
        emoji: EmojiRef;
        guildId?: string;
      };
    }
  | {
      t: ServerEventType.REACTION_REMOVE;
      d: {
        messageId: string;
        channelId: string;
        userId: string;
        emoji: EmojiRef;
        guildId?: string;
      };
    }
  | {
      t: ServerEventType.VOICE_STATE_UPDATE;
      d: {
        userId: string;
        channelId: string | null;
        selfMute: boolean;
        selfDeaf: boolean;
        serverMute: boolean;
        serverDeaf: boolean;
        speaking: boolean;
        guildId?: string;
      };
    }
  | {
      t: ServerEventType.VOICE_SERVER_UPDATE;
      d: { guildId: string; token: string; endpoint: string };
    }
  | {
      t: ServerEventType.READ_STATE_UPDATE;
      d: {
        channelId: string;
        lastReadMessageId: string;
        mentionCount: number;
        userId: string;
      };
    }
  | {
      t: ServerEventType.NOTIFICATION;
      d: {
        id: string;
        type: NotificationType;
        title: string;
        body: string;
        iconUrl?: string;
        targetUrl?: string;
        /** Unix ms timestamp. */
        timestamp: number;
      };
    }
  | { t: ServerEventType.ERROR; d: { code: number; message: string } };

// ---------------------------------------------------------------------------
// Gateway envelope (wire format)
// ---------------------------------------------------------------------------

/**
 * The envelope that wraps every message on the WebSocket connection.
 *
 * @field op  - The opcode classifying this message.
 * @field d   - The payload data for this opcode / event.
 * @field s   - Sequence number (only present on DISPATCH events from the server).
 * @field t   - Event name (only present on DISPATCH events from the server).
 */
export interface GatewayEvent {
  op: OpCode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any;
  s?: number;
  t?: string;
}

/**
 * Typed DISPATCH envelope sent by the server. `t` and `d` are correlated via
 * the `ServerEvent` discriminated union.
 */
export type ServerDispatchEnvelope<E extends ServerEvent = ServerEvent> = {
  op: OpCode.DISPATCH;
  s: number;
  t: E['t'];
  d: Extract<ServerEvent, { t: E['t'] }>['d'];
};

/**
 * Typed envelope sent by the client.
 */
export type ClientEnvelope<E extends ClientEvent = ClientEvent> = {
  op: OpCode;
  t: E['t'];
  d: Extract<ClientEvent, { t: E['t'] }>['d'];
};
