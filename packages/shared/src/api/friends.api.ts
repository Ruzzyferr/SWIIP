import type { AxiosInstance } from 'axios';
import type { UserPayload } from '@constchat/protocol';
import type { RelationshipPayload, RelationshipType } from '../types';

export type { RelationshipPayload, RelationshipType };

export interface UserProfile {
  user: UserPayload;
  relationshipType: RelationshipType | null;
  mutualGuildCount: number;
}

export function createFriendsApi(client: AxiosInstance) {
  return {
    getRelationships: async (): Promise<RelationshipPayload[]> => {
      const res = await client.get<RelationshipPayload[]>('/users/@me/relationships');
      return res.data;
    },
    getFriends: async (): Promise<RelationshipPayload[]> => {
      const res = await client.get<RelationshipPayload[]>('/users/@me/friends');
      return res.data;
    },
    sendFriendRequest: async (username: string, discriminator: string): Promise<void> => {
      await client.post('/users/@me/relationships', { username, discriminator });
    },
    acceptFriendRequest: async (targetId: string): Promise<void> => {
      await client.put(`/users/@me/relationships/${targetId}`);
    },
    removeFriend: async (targetId: string): Promise<void> => {
      await client.delete(`/users/@me/relationships/${targetId}`);
    },
    blockUser: async (targetId: string): Promise<void> => {
      await client.put(`/users/@me/relationships/${targetId}/block`);
    },
    unblockUser: async (targetId: string): Promise<void> => {
      await client.delete(`/users/@me/relationships/${targetId}`, { params: { type: 'unblock' } });
    },
    getUserProfile: async (userId: string): Promise<UserProfile> => {
      const res = await client.get<UserProfile>(`/users/${userId}/profile`);
      return res.data;
    },
    getMutualGuilds: async (userId: string): Promise<Array<{ id: string; name: string }>> => {
      const res = await client.get<Array<{ id: string; name: string }>>(`/users/${userId}/mutual-guilds`);
      return res.data;
    },
  };
}
