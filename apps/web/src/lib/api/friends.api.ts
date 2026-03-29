import { apiClient } from './client';
import type { UserPayload } from '@constchat/protocol';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RelationshipType = 'FRIEND' | 'BLOCKED' | 'PENDING_OUTGOING' | 'PENDING_INCOMING';

export interface RelationshipPayload {
  id: string;
  type: RelationshipType;
  user: UserPayload;
  since: string;
}

export interface UserProfile {
  user: UserPayload;
  relationshipType: RelationshipType | null;
  mutualGuildCount: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function getRelationships(): Promise<RelationshipPayload[]> {
  const res = await apiClient.get<RelationshipPayload[]>('/users/@me/relationships');
  return res.data;
}

export async function getFriends(): Promise<RelationshipPayload[]> {
  const res = await apiClient.get<RelationshipPayload[]>('/users/@me/friends');
  return res.data;
}

export async function sendFriendRequest(username: string, discriminator: string): Promise<void> {
  await apiClient.post('/users/@me/relationships', { username, discriminator });
}

export async function acceptFriendRequest(targetId: string): Promise<void> {
  await apiClient.put(`/users/@me/relationships/${targetId}`);
}

export async function removeFriend(targetId: string): Promise<void> {
  await apiClient.delete(`/users/@me/relationships/${targetId}`);
}

export async function blockUser(targetId: string): Promise<void> {
  await apiClient.put(`/users/@me/relationships/${targetId}/block`);
}

export async function unblockUser(targetId: string): Promise<void> {
  await apiClient.delete(`/users/@me/relationships/${targetId}`, {
    params: { type: 'unblock' },
  });
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const res = await apiClient.get<UserProfile>(`/users/${userId}/profile`);
  return res.data;
}

export async function getMutualGuilds(userId: string): Promise<Array<{ id: string; name: string }>> {
  const res = await apiClient.get<Array<{ id: string; name: string }>>(`/users/${userId}/mutual-guilds`);
  return res.data;
}
