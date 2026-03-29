'use client';

import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';
import { audioTelemetry, type AudioTelemetryEvent } from '@/lib/audio';

interface TrackStats {
  kind: 'audio' | 'video';
  source: string;
  codec: string;
  bitrate: number; // bps
  packetLoss: number; // percentage
  jitter: number; // ms
  roundTripTime: number; // ms
  resolution?: { width: number; height: number };
  frameRate?: number;
}

interface DebugStats {
  localStats: TrackStats[];
  remoteStats: TrackStats[];
  rtt: number;
  timestamp: number;
}

/**
 * Voice debug/stats overlay (Ctrl+Shift+D).
 * Shows WebRTC stats: ping, packet loss, bitrate, codec, jitter, resolution.
 */
export function VoiceDebugOverlay({ room }: { room: React.MutableRefObject<any | null> }) {
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<DebugStats | null>(null);
  const connectionQuality = useVoiceStore((s) => s.connectionQuality);
  const connectionState = useVoiceStore((s) => s.connectionState);
  const pipelineUI = useVoiceStore((s) => s.pipelineUIState);
  const [recentTelemetry, setRecentTelemetry] = useState<AudioTelemetryEvent[]>([]);

  // Toggle with Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const collectStats = useCallback(async () => {
    const r = room.current;
    if (!r || r.state !== 'connected') return;

    const localStats: TrackStats[] = [];
    const remoteStats: TrackStats[] = [];
    let rtt = 0;

    try {
      // Get sender stats (local tracks)
      const senderPC = (r.engine as any)?.publisher?.pc as RTCPeerConnection | undefined;
      if (senderPC) {
        const report = await senderPC.getStats();

        report.forEach((entry: any) => {
          if (entry.type === 'candidate-pair' && entry.currentRoundTripTime) {
            rtt = entry.currentRoundTripTime * 1000; // to ms
          }
          if (entry.type === 'outbound-rtp' && entry.kind) {
            const codec = findCodec(report, entry.codecId);
            const isVideo = entry.kind === 'video';
            localStats.push({
              kind: entry.kind,
              source: isVideo ? (entry.rid || 'video') : 'audio',
              codec: codec || 'unknown',
              bitrate: 0,
              packetLoss: 0,
              jitter: 0,
              roundTripTime: rtt,
              resolution: isVideo && entry.frameWidth ? { width: entry.frameWidth, height: entry.frameHeight || 0 } : undefined,
              frameRate: isVideo ? entry.framesPerSecond : undefined,
            });
          }
        });
      }

      // Get receiver stats (remote tracks)
      const receiverPC = (r.engine as any)?.subscriber?.pc as RTCPeerConnection | undefined;
      if (receiverPC) {
        const report = await receiverPC.getStats();

        report.forEach((entry: any) => {
          if (entry.type === 'candidate-pair' && entry.currentRoundTripTime && rtt === 0) {
            rtt = entry.currentRoundTripTime * 1000;
          }
          if (entry.type === 'inbound-rtp') {
            const codec = findCodec(report, entry.codecId);
            const isVideo = entry.kind === 'video';
            const totalPackets = (entry.packetsReceived || 0) + (entry.packetsLost || 0);
            const loss = totalPackets > 0 ? ((entry.packetsLost || 0) / totalPackets) * 100 : 0;

            remoteStats.push({
              kind: entry.kind,
              source: isVideo ? 'video' : 'audio',
              codec: codec || 'unknown',
              bitrate: 0,
              packetLoss: Math.round(loss * 100) / 100,
              jitter: (entry.jitter || 0) * 1000,
              roundTripTime: rtt,
              resolution: isVideo ? { width: entry.frameWidth || 0, height: entry.frameHeight || 0 } : undefined,
              frameRate: isVideo ? entry.framesPerSecond : undefined,
            });
          }
        });
      }

      setStats({ localStats, remoteStats, rtt, timestamp: Date.now() });
    } catch {
      // Stats collection failed
    }
  }, [room]);

  // Poll stats every second when visible
  useEffect(() => {
    if (!visible) return;
    collectStats();
    const interval = setInterval(collectStats, 1000);
    return () => clearInterval(interval);
  }, [visible, collectStats]);

  // Subscribe to audio telemetry when visible
  useEffect(() => {
    if (!visible) return;
    setRecentTelemetry(audioTelemetry.getRecent(20));
    const unsub = audioTelemetry.subscribe(() => {
      setRecentTelemetry(audioTelemetry.getRecent(20));
    });
    return unsub;
  }, [visible]);

  if (!visible) return null;

  const qualityLabel = ['Lost', 'Poor', 'Good', 'Excellent'][connectionQuality] ?? 'Unknown';
  const qualityColor =
    connectionQuality >= 3 ? '#43b581' :
    connectionQuality === 2 ? '#43b581' :
    connectionQuality === 1 ? '#faa61a' : '#f04747';

  return (
    <div
      className="fixed top-16 right-4 z-[9999] rounded-lg shadow-2xl text-xs font-mono"
      style={{
        background: 'rgba(0, 0, 0, 0.88)',
        color: '#b9bbbe',
        width: 340,
        maxHeight: '70vh',
        overflow: 'auto',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <span className="text-white font-bold text-sm">Voice Debug</span>
        <button onClick={() => setVisible(false)} className="text-white/60 hover:text-white">
          <X size={14} />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Connection info */}
        <div>
          <SectionTitle>Connection</SectionTitle>
          <Row label="State" value={connectionState} />
          <Row label="Quality" value={qualityLabel} valueColor={qualityColor} />
          <Row label="RTT" value={stats ? `${Math.round(stats.rtt)}ms` : '—'} />
        </div>

        {/* Audio Pipeline */}
        <div>
          <SectionTitle>Audio Pipeline</SectionTitle>
          <Row label="Requested" value={pipelineUI.requestedMode} />
          <Row label="Active" value={pipelineUI.activeMode}
            valueColor={pipelineUI.isDegraded ? '#faa61a' : '#43b581'} />
          <Row label="Pipeline" value={pipelineUI.pipelineState} />
          <Row label="Degraded" value={pipelineUI.isDegraded ? 'Yes' : 'No'}
            valueColor={pipelineUI.isDegraded ? '#faa61a' : '#43b581'} />
          {pipelineUI.degradedReason && (
            <Row label="Reason" value={pipelineUI.degradedReason} valueColor="#faa61a" />
          )}
          {pipelineUI.degradedErrorCode && (
            <Row label="Error" value={pipelineUI.degradedErrorCode} valueColor="#f04747" />
          )}
          <Row label="RNNoise" value={pipelineUI.processorStatus.rnnoise} />
          <Row label="Worklet" value={pipelineUI.processorStatus.worklet} />
          <Row label="Platform" value={pipelineUI.supportDetection.platform} />
          <Row label="RNNoise Support" value={pipelineUI.supportDetection.rnnoise} />
          {pipelineUI.latency.workletMs !== null && (
            <Row
              label="Worklet Latency"
              value={`${pipelineUI.latency.workletMs.toFixed(1)}ms`}
              valueColor={pipelineUI.latency.withinBudget ? '#43b581' : '#faa61a'}
            />
          )}
        </div>

        {/* Telemetry Log */}
        {recentTelemetry.length > 0 && (
          <div>
            <SectionTitle>Audio Events (last 20)</SectionTitle>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {recentTelemetry.slice().reverse().map((evt, i) => (
                <div key={i} className="text-[10px] leading-tight opacity-70">
                  <span className="text-white/40">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>{' '}
                  <span className="text-white/80">{evt.type}</span>
                  {evt.reason && <span className="text-white/50"> {evt.reason}</span>}
                  {evt.errorCode && <span className="text-red-400"> [{evt.errorCode}]</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Local tracks */}
        {stats && stats.localStats.length > 0 && (
          <div>
            <SectionTitle>Outbound (You)</SectionTitle>
            {stats.localStats.map((s, i) => (
              <TrackRow key={i} stat={s} />
            ))}
          </div>
        )}

        {/* Remote tracks */}
        {stats && stats.remoteStats.length > 0 && (
          <div>
            <SectionTitle>Inbound (Remote)</SectionTitle>
            {stats.remoteStats.map((s, i) => (
              <TrackRow key={i} stat={s} />
            ))}
          </div>
        )}

        {!stats && (
          <p className="text-white/40 text-center py-2">Collecting stats…</p>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white/60 text-[10px] uppercase tracking-wider mb-1 font-bold">{children}</p>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-white/40">{label}</span>
      <span style={{ color: valueColor || '#dcddde' }}>{value}</span>
    </div>
  );
}

function TrackRow({ stat }: { stat: TrackStats }) {
  const lossColor = stat.packetLoss > 5 ? '#f04747' : stat.packetLoss > 1 ? '#faa61a' : '#43b581';
  return (
    <div className="py-1 px-2 rounded mb-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <div className="flex justify-between">
        <span className="text-white/60">{stat.kind}/{stat.source}</span>
        <span className="text-white/80">{stat.codec}</span>
      </div>
      {stat.resolution && stat.resolution.width > 0 && (
        <div className="flex justify-between">
          <span className="text-white/40">Resolution</span>
          <span>{stat.resolution.width}x{stat.resolution.height} @ {stat.frameRate ?? 0}fps</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-white/40">Packet Loss</span>
        <span style={{ color: lossColor }}>{stat.packetLoss}%</span>
      </div>
      {stat.jitter > 0 && (
        <div className="flex justify-between">
          <span className="text-white/40">Jitter</span>
          <span>{Math.round(stat.jitter)}ms</span>
        </div>
      )}
    </div>
  );
}

function findCodec(report: RTCStatsReport, codecId?: string): string {
  if (!codecId) return '';
  const codec = report.get(codecId) as any;
  if (!codec) return '';
  return codec.mimeType?.split('/')[1] || codec.mimeType || '';
}
