/**
 * Audio pipeline telemetry — structured event logging with ring buffer.
 *
 * Events are stored in memory (not persisted) and exposed to the debug overlay.
 * Subscribers are notified on each new event for real-time UI updates.
 */

import type { AudioTelemetryEvent } from './types';

const BUFFER_SIZE = 200;

type TelemetrySubscriber = (event: AudioTelemetryEvent) => void;

class AudioTelemetry {
  private buffer: AudioTelemetryEvent[] = [];
  private subscribers = new Set<TelemetrySubscriber>();

  /**
   * Log a telemetry event. Automatically sets timestamp if not provided.
   */
  log(event: Omit<AudioTelemetryEvent, 'timestamp'> & { timestamp?: number }): void {
    const fullEvent: AudioTelemetryEvent = {
      ...event,
      timestamp: event.timestamp ?? Date.now(),
    };

    this.buffer.push(fullEvent);

    // Ring buffer: discard oldest when full
    if (this.buffer.length > BUFFER_SIZE) {
      this.buffer.shift();
    }

    // Notify subscribers
    for (const sub of this.subscribers) {
      try {
        sub(fullEvent);
      } catch {
        // Don't let subscriber errors break the pipeline
      }
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      const { type, from, to, reason, errorCode } = fullEvent;
      const parts = [`[AudioTelemetry] ${type}`];
      if (from && to) parts.push(`${from} → ${to}`);
      if (reason) parts.push(`reason: ${reason}`);
      if (errorCode) parts.push(`error: ${errorCode}`);
      console.debug(parts.join(' | '), fullEvent.data ?? '');
    }
  }

  /**
   * Get the full event history (most recent last).
   */
  getHistory(): readonly AudioTelemetryEvent[] {
    return this.buffer;
  }

  /**
   * Get the last N events.
   */
  getRecent(n: number): AudioTelemetryEvent[] {
    return this.buffer.slice(-n);
  }

  /**
   * Subscribe to new events. Returns unsubscribe function.
   */
  subscribe(callback: TelemetrySubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Clear all events and subscribers.
   */
  clear(): void {
    this.buffer = [];
    this.subscribers.clear();
  }
}

/** Singleton telemetry instance for the audio pipeline. */
export const audioTelemetry = new AudioTelemetry();
