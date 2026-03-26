import { apiClient } from './client';
import type { ChannelPayload } from '@constchat/protocol';
import { ChannelType } from '@constchat/protocol';

export interface CreateChannelRequest {
  name: string;
  type?: ChannelType;
  categoryId?: string;
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
  const res = await apiClient.post<ChannelPayload>(
    `/guilds/${guildId}/channels`,
    data
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

export interface ReadStateUpdate {
  lastReadMessageId: string;
}

export async function acknowledgeChannel(
  channelId: string,
  data: ReadStateUpdate
): Promise<void> {
  await apiClient.post(`/channels/${channelId}/ack`, data);
}
