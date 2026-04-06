import { apiClient } from './client';
import type { UserPayload } from '@constchat/protocol';

export interface ProfileLink {
  label: string;
  url: string;
}

export interface UpdateProfileData {
  globalName?: string;
  bio?: string;
  accentColor?: number;
  locale?: string;
  profileLinks?: ProfileLink[];
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

export async function deleteAccount(): Promise<void> {
  await apiClient.delete('/users/@me');
}

export async function uploadBanner(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post<UploadResult>('/uploads/banners', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export interface UserSettings {
  desktopNotifications?: boolean;
  notificationSounds?: boolean;
  messageSounds?: boolean;
  mentionEveryone?: boolean;
  mentionRoles?: boolean;
  flashTaskbar?: boolean;
  badgeCount?: boolean;
  muteAllServers?: boolean;
  [key: string]: unknown;
}

export async function getUserSettings(): Promise<UserSettings> {
  const res = await apiClient.get<UserSettings>('/users/@me/settings');
  return res.data;
}

export async function updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const res = await apiClient.patch<UserSettings>('/users/@me/settings', patch);
  return res.data;
}
