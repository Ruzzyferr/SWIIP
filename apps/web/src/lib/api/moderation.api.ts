import { apiClient } from './client';

export interface AuditLogEntry {
  id: string;
  guildId: string;
  userId: string;
  username?: string;
  actionType: string;
  targetId?: string;
  targetType?: string;
  reason?: string;
  changes?: Record<string, { old?: unknown; new?: unknown }>;
  createdAt: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
}

export interface BanEntry {
  userId: string;
  username?: string;
  avatar?: string;
  reason?: string;
  bannedAt?: string;
}

export async function getAuditLog(
  guildId: string,
  params?: { actionType?: string; userId?: string; limit?: number; before?: string }
): Promise<AuditLogResponse> {
  const res = await apiClient.get<AuditLogResponse>(
    `/guilds/${guildId}/moderation/audit-log`,
    { params }
  );
  return res.data;
}

export async function getBans(guildId: string): Promise<BanEntry[]> {
  const res = await apiClient.get<BanEntry[]>(`/guilds/${guildId}/bans`);
  return res.data;
}
