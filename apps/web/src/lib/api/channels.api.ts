import { apiClient } from './client';
import type { ChannelPayload } from '@constchat/protocol';
import { ChannelType } from '@constchat/protocol';

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

export async function getChannel(channelId: string): Promise<ChannelPayload> {
  const res = await apiClient.get<ChannelPayload>(`/channels/${channelId}`);
  return res.data;
}

export async function getGuildChannels(guildId: string): Promise<ChannelPayload[]> {
  const res = await apiClient.get<ChannelPayload[]>(`/guilds/${guildId}/channels`);
  return res.data;
}

export async function createChannel(
  guildId: string,
  data: CreateChannelRequest
): Promise<ChannelPayload> {
  const { categoryId, ...rest } = data;
  const body = { ...rest, parentId: categoryId ?? rest.parentId };
  const res = await apiClient.post<ChannelPayload>(
    `/guilds/${guildId}/channels`,
    body
  );
  return res.data;
}

export async function updateChannel(
  channelId: string,
  data: UpdateChannelRequest
): Promise<ChannelPayload> {
  const res = await apiClient.patch<ChannelPayload>(`/channels/${channelId}`, data);
  return res.data;
}

export async function deleteChannel(channelId: string): Promise<void> {
  await apiClient.delete(`/channels/${channelId}`);
}

export async function triggerTyping(channelId: string): Promise<void> {
  await apiClient.post(`/channels/${channelId}/typing`);
}

export interface PinnedMessage {
  id: string;
  channelId: string;
  content?: string;
  author?: {
    id: string;
    username: string;
    globalName?: string;
    avatar?: string;
  };
  timestamp?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export async function getPinnedMessages(channelId: string): Promise<PinnedMessage[]> {
  const res = await apiClient.get<PinnedMessage[]>(
    `/channels/${channelId}/pins`
  );
  return res.data;
}

export async function pinMessage(
  channelId: string,
  messageId: string
): Promise<void> {
  await apiClient.put(`/channels/${channelId}/pins/${messageId}`);
}

export async function unpinMessage(
  channelId: string,
  messageId: string
): Promise<void> {
  await apiClient.delete(`/channels/${channelId}/pins/${messageId}`);
}

// Permission overrides
export async function setChannelPermissionOverwrite(
  channelId: string,
  overwriteId: string,
  data: { type: 'role' | 'member'; allow: string; deny: string }
): Promise<ChannelPayload> {
  const res = await apiClient.put<ChannelPayload>(
    `/channels/${channelId}/permissions/${overwriteId}`,
    data
  );
  return res.data;
}

export async function deleteChannelPermissionOverwrite(
  channelId: string,
  overwriteId: string
): Promise<void> {
  await apiClient.delete(`/channels/${channelId}/permissions/${overwriteId}`);
}

export interface ReadStateUpdate {
  lastReadMessageId: string;
}

export async function acknowledgeChannel(
  channelId: string,
  data: ReadStateUpdate
): Promise<void> {
  await apiClient.post(`/channels/${channelId}/ack`, data);
}

export interface ThreadPayload {
  id: string;
  channelId: string;
  parentChannelId: string;
  ownerId: string;
  name: string;
  archived: boolean;
  locked: boolean;
  messageCount: number;
  memberCount: number;
  createdAt: string;
  channel?: ChannelPayload;
}

export async function createThread(
  channelId: string,
  name: string,
  messageId: string,
): Promise<ThreadPayload> {
  const res = await apiClient.post<ThreadPayload>(
    `/channels/${channelId}/threads`,
    { name, messageId },
  );
  return res.data;
}

export async function getThreads(channelId: string): Promise<ThreadPayload[]> {
  const res = await apiClient.get<ThreadPayload[]>(`/channels/${channelId}/threads`);
  return res.data;
}
