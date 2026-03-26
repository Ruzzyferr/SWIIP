'use client';

import { useUIStore } from '@/stores/ui.store';
import { ServerSettings } from './ServerSettings';

export function ServerSettingsWrapper() {
  const guildId = useUIStore((s) => s.serverSettingsGuildId);
  const closeServerSettings = useUIStore((s) => s.closeServerSettings);

  if (!guildId) return null;

  return <ServerSettings guildId={guildId} onClose={closeServerSettings} />;
}
