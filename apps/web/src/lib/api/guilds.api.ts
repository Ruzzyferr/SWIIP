import { apiClient } from './client';
import type { GuildPayload, ChannelPayload, MemberPayload, EmojiRef } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// Custom Emoji types & API
// ---------------------------------------------------------------------------

export interface GuildEmoji {
  id: string;
  name: string;
  animated: boolean;
  url: string;
  creatorId?: string;
}

export async function getGuildEmojis(guildId: string): Promise<GuildEmoji[]> {
  const res = await apiClient.get<GuildEmoji[]>(`/guilds/${guildId}/emojis`);
  return res.data;
}

export async function createGuildEmoji(
  guildId: string,
  data: { name: string; image: string } // image = base64 data URI
): Promise<GuildEmoji> {
  const res = await apiClient.post<GuildEmoji>(`/guilds/${guildId}/emojis`, data);
  return res.data;
}

export async function deleteGuildEmoji(guildId: string, emojiId: string): Promise<void> {
  await apiClient.delete(`/guilds/${guildId}/emojis/${emojiId}`);
}

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
  _guildId: string,
  channelId: string,
  options?: { maxUses?: number; maxAge?: number }
): Promise<CreateInviteResponse> {
  const res = await apiClient.post<CreateInviteResponse>(
    `/channels/${channelId}/invites`,
    options
  );
  return res.data;
}

export async function joinGuildByInvite(code: string): Promise<GuildPayload> {
  const res = await apiClient.post<GuildPayload>(`/invites/${code}`);
  return res.data;
}

export async function resolveInvite(code: string): Promise<{
  code: string;
  guild: { id: string; name: string; icon?: string; memberCount: number; description?: string };
  channel: { id: string; name: string };
  inviter?: { id: string; username: string; globalName?: string };
  expiresAt?: string;
}> {
  const res = await apiClient.get(`/invites/${code}`);
  return res.data;
}

export async function banMember(
  guildId: string,
  userId: string,
  reason?: string
): Promise<void> {
  await apiClient.put(`/guilds/${guildId}/bans/${userId}`, { reason });
}

export async function unbanMember(
  guildId: string,
  userId: string
): Promise<void> {
  await apiClient.delete(`/guilds/${guildId}/bans/${userId}`);
}

export async function updateMember(
  guildId: string,
  userId: string,
  data: { nick?: string; roles?: string[]; mute?: boolean; deaf?: boolean }
): Promise<MemberPayload> {
  const res = await apiClient.patch<MemberPayload>(
    `/guilds/${guildId}/members/${userId}`,
    data
  );
  return res.data;
}
