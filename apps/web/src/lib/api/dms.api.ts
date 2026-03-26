import { apiClient } from './client';
import type { DMChannelPayload, MessagePayload } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateDMRequest {
  recipientId: string;
}

export interface CreateGroupDMRequest {
  recipientIds: string[];
  name?: string;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getDMConversations(): Promise<DMChannelPayload[]> {
  const res = await apiClient.get<DMChannelPayload[]>('/users/@me/conversations');
  return res.data;
}

export async function openDM(recipientId: string): Promise<DMChannelPayload> {
  const res = await apiClient.post<DMChannelPayload>('/users/@me/channels', { recipientId });
  return res.data;
}

export async function createGroupDM(data: CreateGroupDMRequest): Promise<DMChannelPayload> {
  const res = await apiClient.post<DMChannelPayload>('/users/@me/group-channels', data);
  return res.data;
}

export async function getDMChannel(conversationId: string): Promise<DMChannelPayload> {
  const res = await apiClient.get<DMChannelPayload>(`/channels/${conversationId}`);
  return res.data;
}

export async function getDMMessages(
  conversationId: string,
  params?: { before?: string; after?: string; limit?: number }
): Promise<MessagePayload[]> {
  const res = await apiClient.get<MessagePayload[]>(
    `/channels/${conversationId}/messages`,
    { params }
  );
  return res.data;
}

export async function addGroupDMMember(
  conversationId: string,
  userId: string
): Promise<void> {
  await apiClient.post(`/channels/${conversationId}/recipients/${userId}`);
}

export async function removeGroupDMMember(
  conversationId: string,
  userId: string
): Promise<void> {
  await apiClient.delete(`/channels/${conversationId}/recipients/${userId}`);
}
