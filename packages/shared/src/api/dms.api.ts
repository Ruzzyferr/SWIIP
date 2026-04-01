import type { AxiosInstance } from 'axios';
import type { DMChannelPayload, MessagePayload } from '@constchat/protocol';

export interface CreateDMRequest { recipientId: string; }
export interface CreateGroupDMRequest { recipientIds: string[]; name?: string; }

export function createDMsApi(client: AxiosInstance) {
  return {
    getDMConversations: async (): Promise<DMChannelPayload[]> => {
      const res = await client.get<DMChannelPayload[]>('/users/@me/conversations');
      return res.data;
    },
    openDM: async (recipientId: string): Promise<DMChannelPayload> => {
      const res = await client.post<DMChannelPayload>('/users/@me/channels', { recipientId });
      return res.data;
    },
    createGroupDM: async (data: CreateGroupDMRequest): Promise<DMChannelPayload> => {
      const res = await client.post<DMChannelPayload>('/users/@me/group-channels', data);
      return res.data;
    },
    getDMChannel: async (conversationId: string): Promise<DMChannelPayload> => {
      const res = await client.get<DMChannelPayload>(`/users/@me/conversations/${conversationId}`);
      return res.data;
    },
    getDMMessages: async (conversationId: string, params?: { before?: string; after?: string; limit?: number }): Promise<MessagePayload[]> => {
      const res = await client.get<MessagePayload[]>(`/channels/${conversationId}/messages`, { params });
      return res.data;
    },
    addGroupDMMember: async (conversationId: string, userId: string): Promise<void> => {
      await client.post(`/channels/${conversationId}/recipients/${userId}`);
    },
    removeGroupDMMember: async (conversationId: string, userId: string): Promise<void> => {
      await client.delete(`/channels/${conversationId}/recipients/${userId}`);
    },
  };
}
