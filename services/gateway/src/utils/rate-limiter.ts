/**
 * Token bucket rate limiter for per-connection message rate limiting.
 *
 * Each connection gets a bucket that refills at `refillRate` tokens per `windowMs`.
 * A message costs 1 token. If the bucket is empty, the request is rejected.
 */

export interface RateLimiterConfig {
  /** Maximum tokens the bucket can hold (= burst capacity). */
  capacity: number;
  /** How many tokens are added every `windowMs` milliseconds. */
  refillRate: number;
  /** Refill interval in milliseconds. */
  windowMs: number;
}

export interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly config: RateLimiterConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    // Periodically clean up stale buckets (connections that are gone)
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
    this.cleanupInterval.unref();
  }

  /**
   * Attempts to consume one token from the bucket identified by `key`.
   * Returns true if the action is allowed, false if rate limited.
   */
  consume(key: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.config.capacity, lastRefill: now };
      this.buckets.set(key, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refillPeriods = Math.floor(elapsed / this.config.windowMs);
    if (refillPeriods > 0) {
      bucket.tokens = Math.min(
        this.config.capacity,
        bucket.tokens + refillPeriods * this.config.refillRate,
      );
      bucket.lastRefill = now - (elapsed % this.config.windowMs);
    }

    if (bucket.tokens <= 0) {
      return false;
    }

    bucket.tokens -= 1;
    return true;
  }

  /**
   * Returns remaining tokens for a given key without consuming.
   */
  remaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.config.capacity;
    return Math.max(0, bucket.tokens);
  }

  /**
   * Removes a bucket when a connection closes.
   */
  remove(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Removes buckets that haven't been used in over 5 minutes.
   */
  private cleanup(): void {
    const cutoff = Date.now() - 5 * 60_000;
    for (const [key, bucket] of this.buckets) {
      if (bucket.lastRefill < cutoff) {
        this.buckets.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.buckets.clear();
  }
}

/**
 * Gateway default rate limiter: 120 messages per 60s per connection.
 * Burst capacity of 30 (allows brief spikes).
 */
export function createDefaultRateLimiter(): TokenBucketRateLimiter {
  return new TokenBucketRateLimiter({
    capacity: 30,
    refillRate: 2,          // 2 tokens per second = 120/min
    windowMs: 1_000,
  });
}
