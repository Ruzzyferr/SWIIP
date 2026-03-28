import { apiClient } from './client';
import type { RolePayload } from '@constchat/protocol';

export interface CreateRoleRequest {
  name: string;
  color?: number;
  hoist?: boolean;
  mentionable?: boolean;
  permissions?: string;
}

export interface UpdateRoleRequest {
  name?: string;
  color?: number;
  hoist?: boolean;
  mentionable?: boolean;
  permissions?: string;
  position?: number;
}

export async function getGuildRoles(guildId: string): Promise<RolePayload[]> {
  const res = await apiClient.get<RolePayload[]>(`/guilds/${guildId}/roles`);
  return res.data;
}

export async function createRole(
  guildId: string,
  data: CreateRoleRequest
): Promise<RolePayload> {
  const res = await apiClient.post<RolePayload>(`/guilds/${guildId}/roles`, data);
  return res.data;
}

export async function updateRole(
  guildId: string,
  roleId: string,
  data: UpdateRoleRequest
): Promise<RolePayload> {
  const res = await apiClient.patch<RolePayload>(
    `/guilds/${guildId}/roles/${roleId}`,
    data
  );
  return res.data;
}

export async function deleteRole(
  guildId: string,
  roleId: string
): Promise<void> {
  await apiClient.delete(`/guilds/${guildId}/roles/${roleId}`);
}

export async function reorderRoles(
  guildId: string,
  positions: { id: string; position: number }[]
): Promise<RolePayload[]> {
  const res = await apiClient.patch<RolePayload[]>(
    `/guilds/${guildId}/roles`,
    positions
  );
  return res.data;
}
