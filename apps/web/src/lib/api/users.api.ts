import { apiClient } from './client';
import type { UserPayload } from '@constchat/protocol';

export interface UpdateProfileData {
  globalName?: string;
  bio?: string;
  accentColor?: number;
  locale?: string;
}

export async function updateProfile(data: UpdateProfileData): Promise<UserPayload> {
  const res = await apiClient.patch<UserPayload>('/users/@me', data);
  return res.data;
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

export async function uploadAvatar(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<UploadResult>('/uploads/avatars', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function uploadBanner(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<UploadResult>('/uploads/banners', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
