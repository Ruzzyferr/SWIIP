'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, Volume2, MicOff } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';

interface DeviceInfo {
  deviceId: string;
  label: string;
}

function useMediaDevices() {
  const [inputs, setInputs] = useState<DeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<DeviceInfo[]>([]);

  useEffect(() => {
    async function enumerate() {
      try {
        // Request permission first so labels are visible
        await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) =>
          s.getTracks().forEach((t) => t.stop()),
        );
        const devices = await navigator.mediaDevices.enumerateDevices();
        setInputs(
          devices
            .filter((d) => d.kind === 'audioinput')
            .map((d) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 6)}` })),
        );
        setOutputs(
          devices
            .filter((d) => d.kind === 'audiooutput')
            .map((d) => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 6)}` })),
        );
      } catch {
        // Permission denied
      }
    }

    enumerate();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
  }, []);

  return { inputs, outputs };
}

function MicTest() {
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number>(0);
  const inputDeviceId = useVoiceStore((s) => s.settings.inputDeviceId);
  const inputVolume = useVoiceStore((s) => s.settings.inputVolume);

  const startTest = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: inputDeviceId !== 'default' ? { exact: inputDeviceId } : undefined },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setLevel(Math.min(100, (avg / 128) * 100 * (inputVolume / 100)));
        animRef.current = requestAnimationFrame(update);
      };
      update();
      setTesting(true);
    } catch {
      // Permission denied
    }
  }, [inputDeviceId, inputVolume]);

  const stopTest = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setLevel(0);
    setTesting(false);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={testing ? stopTest : startTest}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: testing ? 'var(--color-danger-default)' : 'var(--color-accent-primary)',
          color: '#fff',
        }}
      >
        {testing ? <MicOff size={16} /> : <Mic size={16} />}
        {testing ? 'Stop Test' : 'Test Mic'}
      </button>
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--color-surface-base)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${level}%`,
            background: level > 80 ? 'var(--color-danger-default)' : 'var(--color-success-default)',
          }}
        />
      </div>
    </div>
  );
}

function Slider({
  value,
  min = 0,
  max = 100,
  onChange,
  label,
  suffix = '%',
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
        <span className="text-sm" style={{ color: 'var(--color-text-disabled)' }}>
          {value}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-accent-primary)]"
        style={{ height: 6 }}
      />
    </div>
  );
}

function DeviceSelect({
  label,
  icon: Icon,
  devices,
  value,
  onChange,
}: {
  label: string;
  icon: typeof Mic;
  devices: DeviceInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-text-disabled)' }}
      >
        <Icon size={14} />
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{
          background: 'var(--color-surface-base)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border-subtle)',
        }}
      >
        <option value="default">Default</option>
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PushToTalkKeybind({ currentKey, onChange }: { currentKey: string; onChange: (key: string) => void }) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const key = e.code === 'Space' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.code;
      onChange(key);
      setRecording(false);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [recording, onChange]);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg"
      style={{ background: 'var(--color-surface-raised)' }}>
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
          Push to Talk Key
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          Hold this key to transmit your voice
        </p>
      </div>
      <button
        onClick={() => setRecording(!recording)}
        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{
          background: recording ? 'var(--color-danger-default)' : 'var(--color-surface-overlay)',
          color: recording ? '#fff' : 'var(--color-text-primary)',
          border: recording ? 'none' : '1px solid var(--color-border-default)',
          minWidth: 120,
        }}
      >
        {recording ? 'Press a key...' : currentKey}
      </button>
    </div>
  );
}

export function VoiceSettingsPage() {
  const settings = useVoiceStore((s) => s.settings);
  const updateSettings = useVoiceStore((s) => s.updateSettings);
  const { inputs, outputs } = useMediaDevices();

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
        Voice & Video
      </h2>

      {/* Input device */}
      <section className="space-y-4">
        <DeviceSelect
          label="Input Device"
          icon={Mic}
          devices={inputs}
          value={settings.inputDeviceId}
          onChange={(id) => updateSettings({ inputDeviceId: id })}
        />
        <Slider
          label="Input Volume"
          value={settings.inputVolume}
          onChange={(v) => updateSettings({ inputVolume: v })}
        />
        <MicTest />
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Output device */}
      <section className="space-y-4">
        <DeviceSelect
          label="Output Device"
          icon={Volume2}
          devices={outputs}
          value={settings.outputDeviceId}
          onChange={(id) => updateSettings({ outputDeviceId: id })}
        />
        <Slider
          label="Output Volume"
          value={settings.outputVolume}
          max={100}
          onChange={(v) => updateSettings({ outputVolume: v })}
        />
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Input Mode — Voice Activity vs Push to Talk */}
      <section className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-disabled)' }}>
          Input Mode
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => updateSettings({ pushToTalk: false })}
            className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all text-center"
            style={{
              background: !settings.pushToTalk ? 'var(--color-accent-primary)' : 'var(--color-surface-raised)',
              color: !settings.pushToTalk ? '#fff' : 'var(--color-text-secondary)',
              border: !settings.pushToTalk ? 'none' : '1px solid var(--color-border-default)',
            }}
          >
            Voice Activity
          </button>
          <button
            onClick={() => updateSettings({ pushToTalk: true })}
            className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-all text-center"
            style={{
              background: settings.pushToTalk ? 'var(--color-accent-primary)' : 'var(--color-surface-raised)',
              color: settings.pushToTalk ? '#fff' : 'var(--color-text-secondary)',
              border: settings.pushToTalk ? 'none' : '1px solid var(--color-border-default)',
            }}
          >
            Push to Talk
          </button>
        </div>
        {settings.pushToTalk && (
          <PushToTalkKeybind
            currentKey={settings.pttKey}
            onChange={(key) => updateSettings({ pttKey: key })}
          />
        )}
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Input sensitivity / voice activity threshold */}
      <section className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-disabled)' }}>
              Input Sensitivity
            </p>
            <button
              onClick={() =>
                updateSettings({
                  voiceActivityThreshold: settings.voiceActivityThreshold === -1 ? 50 : -1,
                })
              }
              className="text-xs font-medium px-2 py-0.5 rounded"
              style={{
                background: settings.voiceActivityThreshold === -1
                  ? 'var(--color-success-muted, rgba(87, 242, 135, 0.15))'
                  : 'var(--color-surface-base)',
                color: settings.voiceActivityThreshold === -1
                  ? 'var(--color-success-default)'
                  : 'var(--color-text-secondary)',
              }}
            >
              {settings.voiceActivityThreshold === -1 ? 'Automatic' : 'Manual'}
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-disabled)' }}>
            {settings.voiceActivityThreshold === -1
              ? 'Automatically determines when you are speaking'
              : 'Adjust the sensitivity — sounds below the threshold will not be transmitted'}
          </p>
          {settings.voiceActivityThreshold !== -1 && (
            <Slider
              label="Threshold"
              value={settings.voiceActivityThreshold}
              min={0}
              max={100}
              onChange={(v) => updateSettings({ voiceActivityThreshold: v })}
            />
          )}
        </div>
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Noise suppression */}
      <section className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Noise Suppression
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
            Krisp AI-powered noise filter for your microphone
          </p>
        </div>
        <button
          onClick={() => updateSettings({ noiseSuppression: !settings.noiseSuppression })}
          className="relative w-11 h-6 rounded-full transition-colors duration-200"
          style={{
            background: settings.noiseSuppression
              ? 'var(--color-success-default)'
              : 'var(--color-surface-base)',
          }}
        >
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
            style={{
              transform: settings.noiseSuppression ? 'translateX(22px)' : 'translateX(2px)',
            }}
          />
        </button>
      </section>

      <div className="h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Notification sounds */}
      <section className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Notification Sounds
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
            Play sounds when users join or leave voice channels
          </p>
        </div>
        <button
          onClick={() => updateSettings({ notificationSounds: !settings.notificationSounds })}
          className="relative w-11 h-6 rounded-full transition-colors duration-200"
          style={{
            background: settings.notificationSounds
              ? 'var(--color-success-default)'
              : 'var(--color-surface-base)',
          }}
        >
          <div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
            style={{
              transform: settings.notificationSounds ? 'translateX(22px)' : 'translateX(2px)',
            }}
          />
        </button>
      </section>
    </div>
  );
}
