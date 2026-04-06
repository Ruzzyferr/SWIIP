'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, ArrowLeft, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { discoverGuilds, joinGuild, type DiscoverGuild } from '@/lib/api/guilds.api';

function GuildCard({ guild, onJoin }: { guild: DiscoverGuild; onJoin: (id: string) => void }) {
  const router = useRouter();

  return (
    <div
      className="rounded-xl overflow-hidden transition-all hover:scale-[1.02] cursor-pointer"
      style={{
        background: 'var(--color-surface-raised)',
        border: '1px solid var(--color-border-subtle)',
      }}
      onClick={() => {
        if (guild.joined) {
          router.push(`/channels/${guild.id}`);
        }
      }}
    >
      {/* Splash / banner */}
      <div
        className="h-28 w-full"
        style={{
          background: guild.splash
            ? `url(${guild.splash}) center/cover`
            : 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-hover, #059669))',
        }}
      />

      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar
            src={guild.icon}
            displayName={guild.name}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {guild.name}
            </h3>
            {guild.description && (
              <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                {guild.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-disabled)' }}>
            <Users size={12} />
            <span>{guild.memberCount.toLocaleString()} members</span>
          </div>

          {guild.joined ? (
            <span
              className="text-xs font-medium px-3 py-1.5 rounded-md"
              style={{ background: 'var(--color-surface-overlay)', color: 'var(--color-text-secondary)' }}
            >
              Joined
            </span>
          ) : (
            <button
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{ background: 'var(--color-accent-primary)', color: '#fff' }}
              onClick={(e) => {
                e.stopPropagation();
                onJoin(guild.id);
              }}
            >
              Join Server
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const [guilds, setGuilds] = useState<DiscoverGuild[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchDebounce, setSearchDebounce] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounce(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchGuilds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await discoverGuilds({
        search: searchDebounce || undefined,
        limit: 20,
      });
      setGuilds(data.guilds);
      setTotal(data.total);
    } catch {
      setGuilds([]);
    } finally {
      setLoading(false);
    }
  }, [searchDebounce]);

  useEffect(() => {
    fetchGuilds();
  }, [fetchGuilds]);

  const handleJoin = async (guildId: string) => {
    try {
      await joinGuild(guildId);
      setGuilds((prev) =>
        prev.map((g) => (g.id === guildId ? { ...g, joined: true } : g)),
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      {/* Header */}
      <div
        className="px-6 py-8 flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-hover, #059669))',
        }}
      >
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium"
          style={{ color: 'rgba(255,255,255,0.8)' }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <h1 className="text-2xl font-bold text-white mb-2">
          Discover Servers
        </h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Find communities to join
        </p>
        <div className="relative mt-4 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(255,255,255,0.5)' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search servers..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
            style={{
              background: 'rgba(0,0,0,0.25)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          />
        </div>
      </div>

      {/* Results */}
      <div className="p-6 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-text-disabled)' }} />
          </div>
        ) : guilds.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
              {search ? 'No servers found matching your search.' : 'No discoverable servers available yet.'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-disabled)' }}>
              {total} server{total !== 1 ? 's' : ''} found
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {guilds.map((guild) => (
                <GuildCard key={guild.id} guild={guild} onJoin={handleJoin} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
