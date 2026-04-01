import type { AxiosInstance } from 'axios';
import type { ChannelPayload } from '@constchat/protocol';
import { ChannelType } from '@constchat/protocol';

export { ChannelType };

export interface CreateChannelRequest {
  name: string;
  type?: ChannelType;
  categoryId?: string;
  parentId?: string;
  topic?: string;
  position?: number;
}

export interface UpdateChannelRequest {
  name?: string;
  topic?: string;
  position?: number;
  categoryId?: string | null;
  slowmode?: number;
  nsfw?: boolean;
}

export interface PinnedMessage {
  id: string;
  channelId: string;
  content?: string;
  author?: { id: string; username: string; globalName?: string; avatar?: string };
  timestamp?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ReadStateUpdate {
  lastReadMessageId: string;
}

export function createChannelsApi(client: AxiosInstance) {
  return {
    getChannel: async (channelId: string): Promise<ChannelPayload> => {
      const res = await client.get<ChannelPayload>(`/channels/${channelId}`);
      return res.data;
    },
    getGuildChannels: async (guildId: string): Promise<ChannelPayload[]> => {
      const res = await client.get<ChannelPayload[]>(`/guilds/${guildId}/channels`);
      return res.data;
    },
    createChannel: async (guildId: string, data: CreateChannelRequest): Promise<ChannelPayload> => {
      const { categoryId, ...rest } = data;
      const body = { ...rest, parentId: categoryId ?? rest.parentId };
      const res = await client.post<ChannelPayload>(`/guilds/${guildId}/channels`, body);
      return res.data;
    },
    updateChannel: async (channelId: string, data: UpdateChannelRequest): Promise<ChannelPayload> => {
      const res = await client.patch<ChannelPayload>(`/channels/${channelId}`, data);
      return res.data;
    },
    deleteChannel: async (channelId: string): Promise<void> => {
      await client.delete(`/channels/${channelId}`);
    },
    triggerTyping: async (channelId: string): Promise<void> => {
      await client.post(`/channels/${channelId}/typing`);
    },
    getPinnedMessages: async (channelId: string): Promise<PinnedMessage[]> => {
      const res = await client.get<PinnedMessage[]>(`/channels/${channelId}/pins`);
      return res.data;
    },
    pinMessage: async (channelId: string, messageId: string): Promise<void> => {
      await client.put(`/channels/${channelId}/pins/${messageId}`);
    },
    unpinMessage: async (channelId: string, messageId: string): Promise<void> => {
      await client.delete(`/channels/${channelId}/pins/${messageId}`);
    },
    setChannelPermissionOverwrite: async (channelId: string, overwriteId: string, data: { type: 'role' | 'member'; allow: string; deny: string }): Promise<ChannelPayload> => {
      const res = await client.put<ChannelPayload>(`/channels/${channelId}/permissions/${overwriteId}`, data);
      return res.data;
    },
    deleteChannelPermissionOverwrite: async (channelId: string, overwriteId: string): Promise<void> => {
      await client.delete(`/channels/${channelId}/permissions/${overwriteId}`);
    },
    acknowledgeChannel: async (channelId: string, data: ReadStateUpdate): Promise<void> => {
      await client.post(`/channels/${channelId}/ack`, data);
    },
  };
}
