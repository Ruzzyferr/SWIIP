import type { AxiosInstance } from 'axios';
import type { GuildPayload, MemberPayload } from '@constchat/protocol';

export interface GuildEmoji {
  id: string;
  name: string;
  animated: boolean;
  url: string;
  creatorId?: string;
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

export interface CreateInviteResponse {
  code: string;
  guildId: string;
  channelId: string;
  expiresAt: string | null;
  maxUses: number;
  uses: number;
}

export function createGuildsApi(client: AxiosInstance) {
  return {
    getGuilds: async (): Promise<GuildPayload[]> => {
      const res = await client.get<GuildPayload[]>('/guilds');
      return res.data;
    },
    getGuild: async (guildId: string): Promise<GuildPayload> => {
      const res = await client.get<GuildPayload>(`/guilds/${guildId}`);
      return res.data;
    },
    createGuild: async (data: CreateGuildRequest): Promise<GuildPayload> => {
      const res = await client.post<GuildPayload>('/guilds', data);
      return res.data;
    },
    updateGuild: async (guildId: string, data: UpdateGuildRequest): Promise<GuildPayload> => {
      const res = await client.patch<GuildPayload>(`/guilds/${guildId}`, data);
      return res.data;
    },
    deleteGuild: async (guildId: string): Promise<void> => {
      await client.delete(`/guilds/${guildId}`);
    },
    leaveGuild: async (guildId: string): Promise<void> => {
      await client.delete(`/guilds/${guildId}/members/@me`);
    },
    getGuildMembers: async (guildId: string): Promise<MemberPayload[]> => {
      const res = await client.get<MemberPayload[]>(`/guilds/${guildId}/members`);
      return res.data;
    },
    getGuildMember: async (guildId: string, userId: string): Promise<MemberPayload> => {
      const res = await client.get<MemberPayload>(`/guilds/${guildId}/members/${userId}`);
      return res.data;
    },
    kickMember: async (guildId: string, userId: string): Promise<void> => {
      await client.delete(`/guilds/${guildId}/members/${userId}`);
    },
    banMember: async (guildId: string, userId: string, reason?: string): Promise<void> => {
      await client.put(`/guilds/${guildId}/bans/${userId}`, { reason });
    },
    unbanMember: async (guildId: string, userId: string): Promise<void> => {
      await client.delete(`/guilds/${guildId}/bans/${userId}`);
    },
    updateMember: async (guildId: string, userId: string, data: { nick?: string; roles?: string[]; mute?: boolean; deaf?: boolean }): Promise<MemberPayload> => {
      const res = await client.patch<MemberPayload>(`/guilds/${guildId}/members/${userId}`, data);
      return res.data;
    },
    createInvite: async (_guildId: string, channelId: string, options?: { maxUses?: number; maxAge?: number }): Promise<CreateInviteResponse> => {
      const res = await client.post<CreateInviteResponse>(`/channels/${channelId}/invites`, options);
      return res.data;
    },
    joinGuildByInvite: async (code: string): Promise<GuildPayload> => {
      const res = await client.post<GuildPayload>(`/invites/${code}`);
      return res.data;
    },
    resolveInvite: async (code: string) => {
      const res = await client.get(`/invites/${code}`);
      return res.data;
    },
    getGuildEmojis: async (guildId: string): Promise<GuildEmoji[]> => {
      const res = await client.get<GuildEmoji[]>(`/guilds/${guildId}/emojis`);
      return res.data;
    },
    createGuildEmoji: async (guildId: string, data: { name: string; image: string }): Promise<GuildEmoji> => {
      const res = await client.post<GuildEmoji>(`/guilds/${guildId}/emojis`, data);
      return res.data;
    },
    deleteGuildEmoji: async (guildId: string, emojiId: string): Promise<void> => {
      await client.delete(`/guilds/${guildId}/emojis/${emojiId}`);
    },
  };
}
