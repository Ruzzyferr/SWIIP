import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type GatewayStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface GatewayState {
  status: GatewayStatus;
  sessionId: string | null;
  sequence: number;
  latency: number;
  reconnectAttempts: number;

  // Actions
  setStatus: (status: GatewayStatus) => void;
  setSessionId: (id: string) => void;
  setSequence: (seq: number) => void;
  setLatency: (ms: number) => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  reset: () => void;
}

export const useGatewayStore = create<GatewayState>()(
  immer((set) => ({
    status: 'disconnected',
    sessionId: null,
    sequence: 0,
    latency: 0,
    reconnectAttempts: 0,

    setStatus: (status) =>
      set((state) => {
        state.status = status;
      }),

    setSessionId: (id) =>
      set((state) => {
        state.sessionId = id;
      }),

    setSequence: (seq) =>
      set((state) => {
        state.sequence = seq;
      }),

    setLatency: (ms) =>
      set((state) => {
        state.latency = ms;
      }),

    incrementReconnectAttempts: () =>
      set((state) => {
        state.reconnectAttempts += 1;
      }),

    resetReconnectAttempts: () =>
      set((state) => {
        state.reconnectAttempts = 0;
      }),

    reset: () =>
      set((state) => {
        state.status = 'disconnected';
        state.sessionId = null;
        state.sequence = 0;
        state.latency = 0;
        state.reconnectAttempts = 0;
      }),
  }))
);
