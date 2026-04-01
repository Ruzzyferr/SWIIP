import type { AxiosInstance } from 'axios';
import type { MessagePayload, EmojiRef, AttachmentRef } from '@constchat/protocol';

export interface GetMessagesParams {
  before?: string;
  after?: string;
  around?: string;
  limit?: number;
}

export interface SendMessageRequest {
  content?: string;
  nonce?: string;
  replyToId?: string;
  attachmentIds?: string[];
  attachments?: AttachmentRef[];
  mentionedUserIds?: string[];
}

export interface EditMessageRequest {
  content: string;
}

export interface SearchMessagesParams {
  q: string;
  channelId?: string;
  authorId?: string;
  before?: string;
  after?: string;
  has?: string;
}

export interface UploadAttachmentResponse {
  uploadUrl: string;
  uploadId: string;
  filename: string;
}

export function parseSearchQuery(raw: string) {
  const filters: Record<string, string> = {};
  const text = raw.replace(/\b(from|before|after|has|in):(\S+)/gi, (_, key, value) => {
    filters[key.toLowerCase()] = value;
    return '';
  }).trim();

  return {
    text,
    authorId: filters.from,
    before: filters.before,
    after: filters.after,
    has: filters.has,
    channelId: filters.in,
  };
}

export function createMessagesApi(client: AxiosInstance) {
  return {
    getMessages: async (channelId: string, params?: GetMessagesParams): Promise<MessagePayload[]> => {
      const res = await client.get<MessagePayload[]>(`/channels/${channelId}/messages`, { params });
      return res.data;
    },
    getMessage: async (channelId: string, messageId: string): Promise<MessagePayload> => {
      const res = await client.get<MessagePayload>(`/channels/${channelId}/messages/${messageId}`);
      return res.data;
    },
    sendMessage: async (channelId: string, data: SendMessageRequest): Promise<MessagePayload> => {
      const res = await client.post<MessagePayload>(`/channels/${channelId}/messages`, {
        content: data.content,
        nonce: data.nonce,
        referencedMessageId: data.replyToId,
        attachmentIds: data.attachmentIds,
        mentionedUserIds: data.mentionedUserIds,
      });
      return res.data;
    },
    editMessage: async (channelId: string, messageId: string, data: EditMessageRequest): Promise<MessagePayload> => {
      const res = await client.patch<MessagePayload>(`/channels/${channelId}/messages/${messageId}`, data);
      return res.data;
    },
    deleteMessage: async (channelId: string, messageId: string): Promise<void> => {
      await client.delete(`/channels/${channelId}/messages/${messageId}`);
    },
    bulkDeleteMessages: async (channelId: string, messageIds: string[]): Promise<void> => {
      await client.post(`/channels/${channelId}/messages/bulk-delete`, { messages: messageIds });
    },
    addReaction: async (channelId: string, messageId: string, emoji: EmojiRef): Promise<void> => {
      const emojiKey = emoji.id ? `${emoji.name}:${emoji.id}` : encodeURIComponent(emoji.name);
      await client.put(`/channels/${channelId}/messages/${messageId}/reactions/${emojiKey}/@me`);
    },
    removeReaction: async (channelId: string, messageId: string, emoji: EmojiRef, userId = '@me'): Promise<void> => {
      const emojiKey = emoji.id ? `${emoji.name}:${emoji.id}` : encodeURIComponent(emoji.name);
      await client.delete(`/channels/${channelId}/messages/${messageId}/reactions/${emojiKey}/${userId}`);
    },
    searchMessages: async (guildId: string, query: string, channelId?: string, extra?: Omit<SearchMessagesParams, 'q' | 'channelId'>): Promise<MessagePayload[]> => {
      const res = await client.get<MessagePayload[]>(`/guilds/${guildId}/messages/search`, { params: { q: query, channelId, ...extra } });
      return res.data;
    },
    searchChannelMessages: async (channelId: string, query: string, extra?: Omit<SearchMessagesParams, 'q' | 'channelId'>): Promise<MessagePayload[]> => {
      const res = await client.get<{ results: MessagePayload[]; total: number }>(`/channels/${channelId}/search/messages`, { params: { q: query, ...extra } });
      return res.data.results ?? res.data as any;
    },
    requestAttachmentUpload: async (channelId: string, files: Array<{ filename: string; fileSize: number; contentType: string }>): Promise<UploadAttachmentResponse[]> => {
      const res = await client.post<UploadAttachmentResponse[]>(`/uploads/channels/${channelId}/attachments`, { files });
      return res.data;
    },
  };
}
