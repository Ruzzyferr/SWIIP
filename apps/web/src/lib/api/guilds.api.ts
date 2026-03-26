import { apiClient } from './client';
import type { GuildPayload, ChannelPayload, MemberPayload } from '@constchat/protocol';

export interface CreateGuildRequest {
  name: string;
  iconUrl?: string;
}

export interface UpdateGuildRequest {
  name?: string;
  description?: string;
  iconUrl?: string;
  bannerUrl?: string;
}

export async function getGuilds(): Promise<GuildPayload[]> {
  const res = await apiClient.get<GuildPayload[]>('/guilds');
  return res.data;
}

export async function getGuild(guildId: string): Promise<GuildPayload> {
  const res = await apiClient.get<GuildPayload>(`/guilds/${guildId}`);
  return res.data;
}

export async function createGuild(data: CreateGuildRequest): Promise<GuildPayload> {
  const res = await apiClient.post<GuildPayload>('/guilds', data);
  return res.data;
}

export async function updateGuild(
  guildId: string,
  data: UpdateGuildRequest
): Promise<GuildPayload> {
  const res = await apiClient.patch<GuildPayload>(`/guilds/${guildId}`, data);
  return res.data;
}

export async function deleteGuild(guildId: string): Promise<void> {
  await apiClient.delete(`/guilds/${guildId}`);
}

export async function leaveGuild(guildId: string): Promise<void> {
  await apiClient.delete(`/guilds/${guildId}/members/@me`);
}

export async function getGuildMembers(guildId: string): Promise<MemberPayload[]> {
  const res = await apiClient.get<MemberPayload[]>(`/guilds/${guildId}/members`);
  return res.data;
}

export async function getGuildMember(
  guildId: string,
  userId: string
): Promise<MemberPayload> {
  const res = await apiClient.get<MemberPayload>(
    `/guilds/${guildId}/members/${userId}`
  );
  return res.data;
}

export async function kickMember(guildId: string, userId: string): Promise<void> {
  await apiClient.delete(`/guilds/${guildId}/members/${userId}`);
}

export interface CreateInviteResponse {
  code: string;
  guildId: string;
  channelId: string;
  expiresAt: string | null;
  maxUses: number;
  uses: number;
}

export async function createInvite(
  guildId: string,
  channelId: string,
  options?: { maxUses?: number; expiresIn?: number }
): Promise<CreateInviteResponse> {
  const res = await apiClient.post<CreateInviteResponse>(
    `/guilds/${guildId}/invites`,
    { channelId, ...options }
  );
  return res.data;
}

export async function joinGuildByInvite(code: string): Promise<GuildPayload> {
  const res = await apiClient.post<GuildPayload>(`/invites/${code}`);
  return res.data;
}
