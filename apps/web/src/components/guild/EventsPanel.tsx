'use client';

import { useEffect, useState, useCallback } from 'react';
import { Calendar, MapPin, Clock, Plus, Users, Star, Trash2, X } from 'lucide-react';
import { getGuildEvents, createGuildEvent, deleteGuildEvent, markEventInterested, type ScheduledEvent } from '@/lib/api/guilds.api';
import { useAuthStore } from '@/stores/auth.store';
import { formatDistanceToNow } from 'date-fns';

function EventCard({
  event,
  isCreator,
  onInterested,
  onDelete,
}: {
  event: ScheduledEvent;
  isCreator: boolean;
  onInterested: () => void;
  onDelete: () => void;
}) {
  const startDate = new Date(event.startTime);
  const isUpcoming = startDate > new Date();
  const isActive = event.status === 'ACTIVE';

  return (
    <div
      className="rounded-lg p-4 transition-all"
      style={{
        background: 'var(--color-surface-raised)',
        border: isActive
          ? '1px solid var(--color-success-default)'
          : '1px solid var(--color-border-subtle)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isActive && (
              <span
                className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                style={{ background: 'var(--color-success-default)', color: '#fff' }}
              >
                LIVE
              </span>
            )}
            <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
              {event.name}
            </h4>
          </div>
          {event.description && (
            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
              {event.description}
            </p>
          )}
        </div>
        {isCreator && (
          <button
            onClick={onDelete}
            className="p-1 rounded transition-colors flex-shrink-0"
            style={{ color: 'var(--color-text-disabled)' }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1 mt-3">
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <Clock size={12} />
          <span>
            {startDate.toLocaleDateString()} {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {isUpcoming && ` (${formatDistanceToNow(startDate, { addSuffix: true })})`}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <MapPin size={12} />
            <span>{event.location}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-disabled)' }}>
          <Star size={12} />
          <span>{event.interestedCount} interested</span>
        </div>
        <button
          onClick={onInterested}
          className="text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
          style={{
            background: 'var(--color-accent-muted)',
            color: 'var(--color-accent-primary)',
          }}
        >
          Interested
        </button>
      </div>
    </div>
  );
}

function CreateEventForm({
  guildId,
  onCreated,
  onCancel,
}: {
  guildId: string;
  onCreated: (event: ScheduledEvent) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startTime) return;
    setSubmitting(true);
    try {
      const event = await createGuildEvent(guildId, {
        name: name.trim(),
        description: description.trim() || undefined,
        startTime: new Date(startTime).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        location: location.trim() || undefined,
      });
      onCreated(event);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    background: 'var(--color-surface-base)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-default)',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-lg" style={{ background: 'var(--color-surface-raised)' }}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>New Event</h4>
        <button type="button" onClick={onCancel} style={{ color: 'var(--color-text-disabled)' }}><X size={16} /></button>
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Event name"
        required
        className="w-full px-3 py-2 rounded-md text-sm"
        style={inputStyle}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full px-3 py-2 rounded-md text-sm resize-none"
        style={inputStyle}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-disabled)' }}>Start</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
            className="w-full px-2 py-1.5 rounded-md text-xs"
            style={inputStyle}
          />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-disabled)' }}>End</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-2 py-1.5 rounded-md text-xs"
            style={inputStyle}
          />
        </div>
      </div>
      <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (optional)"
        className="w-full px-3 py-2 rounded-md text-sm"
        style={inputStyle}
      />
      <button
        type="submit"
        disabled={submitting || !name.trim() || !startTime}
        className="w-full py-2 rounded-md text-sm font-medium"
        style={{ background: 'var(--color-accent-primary)', color: '#fff', opacity: submitting ? 0.6 : 1 }}
      >
        {submitting ? 'Creating...' : 'Create Event'}
      </button>
    </form>
  );
}

export function EventsPanel({ guildId }: { guildId: string }) {
  const [events, setEvents] = useState<ScheduledEvent[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const userId = useAuthStore((s) => s.user?.id);

  const loadEvents = useCallback(async () => {
    try {
      const data = await getGuildEvents(guildId);
      setEvents(data);
    } catch {
      setEvents([]);
    } finally {
      setLoaded(true);
    }
  }, [guildId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleInterested = async (eventId: string) => {
    try {
      await markEventInterested(guildId, eventId);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, interestedCount: e.interestedCount + 1 } : e)),
      );
    } catch {
      // ignore
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      await deleteGuildEvent(guildId, eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={16} style={{ color: 'var(--color-text-secondary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Events
          </h3>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <Plus size={16} />
        </button>
      </div>

      {showCreate && (
        <CreateEventForm
          guildId={guildId}
          onCreated={(event) => {
            setEvents((prev) => [event, ...prev]);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {loaded && events.length === 0 && !showCreate && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--color-text-disabled)' }}>
          No upcoming events
        </p>
      )}

      {events.map((event) => (
        <EventCard
          key={event.id}
          event={event}
          isCreator={event.creatorId === userId}
          onInterested={() => handleInterested(event.id)}
          onDelete={() => handleDelete(event.id)}
        />
      ))}
    </div>
  );
}
