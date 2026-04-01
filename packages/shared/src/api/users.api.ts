import type { AxiosInstance } from 'axios';
import type { UserPayload } from '@constchat/protocol';

export interface UpdateProfileData {
  globalName?: string;
  bio?: string;
  accentColor?: number;
  locale?: string;
}

export interface UploadResult {
  s3Key: string;
  cdnUrl: string;
  filename: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
}

export function createUsersApi(client: AxiosInstance) {
  return {
    updateProfile: async (data: UpdateProfileData): Promise<UserPayload> => {
      const res = await client.patch<UserPayload>('/users/@me', data);
      return res.data;
    },
    deleteAccount: async (): Promise<void> => {
      await client.delete('/users/@me');
    },
  };
}
