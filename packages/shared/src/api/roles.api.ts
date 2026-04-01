import type { AxiosInstance } from 'axios';
import type { RolePayload } from '@constchat/protocol';

export interface CreateRoleRequest { name: string; color?: number; hoist?: boolean; mentionable?: boolean; permissions?: string; }
export interface UpdateRoleRequest { name?: string; color?: number; hoist?: boolean; mentionable?: boolean; permissions?: string; position?: number; }

export function createRolesApi(client: AxiosInstance) {
  return {
    getGuildRoles: async (guildId: string): Promise<RolePayload[]> => {
      const res = await client.get<RolePayload[]>(`/guilds/${guildId}/roles`);
      return res.data;
    },
    createRole: async (guildId: string, data: CreateRoleRequest): Promise<RolePayload> => {
      const res = await client.post<RolePayload>(`/guilds/${guildId}/roles`, data);
      return res.data;
    },
    updateRole: async (guildId: string, roleId: string, data: UpdateRoleRequest): Promise<RolePayload> => {
      const res = await client.patch<RolePayload>(`/guilds/${guildId}/roles/${roleId}`, data);
      return res.data;
    },
    deleteRole: async (guildId: string, roleId: string): Promise<void> => {
      await client.delete(`/guilds/${guildId}/roles/${roleId}`);
    },
    reorderRoles: async (guildId: string, positions: { id: string; position: number }[]): Promise<RolePayload[]> => {
      const res = await client.patch<RolePayload[]>(`/guilds/${guildId}/roles`, positions);
      return res.data;
    },
  };
}
