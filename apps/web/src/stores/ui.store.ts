import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ActiveModal {
  type: string;
  props?: Record<string, unknown>;
}

interface UIState {
  activeGuildId: string | null;
  activeChannelId: string | null;
  activeDMId: string | null;
  isMemberSidebarOpen: boolean;
  isSettingsOpen: boolean;
  settingsPage: string;
  activeModal: ActiveModal | null;
  isMobileNavOpen: boolean;
  serverSettingsGuildId: string | null;
  activeThreadId: string | null;

  // Actions
  setActiveGuild: (guildId: string | null) => void;
  setActiveChannel: (channelId: string | null) => void;
  setActiveDM: (dmId: string | null) => void;
  openModal: (type: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
  toggleMemberSidebar: () => void;
  setMemberSidebarOpen: (open: boolean) => void;
  openSettings: (page?: string) => void;
  closeSettings: () => void;
  setSettingsPage: (page: string) => void;
  toggleMobileNav: () => void;
  setMobileNavOpen: (open: boolean) => void;
  openServerSettings: (guildId: string) => void;
  closeServerSettings: () => void;
  openThread: (threadId: string) => void;
  closeThread: () => void;
}

export const useUIStore = create<UIState>()(
  immer((set) => ({
    activeGuildId: null,
    activeChannelId: null,
    activeDMId: null,
    isMemberSidebarOpen: true,
    isSettingsOpen: false,
    settingsPage: 'account',
    activeModal: null,
    isMobileNavOpen: false,
    serverSettingsGuildId: null,
    activeThreadId: null,

    setActiveGuild: (guildId) =>
      set((state) => {
        state.activeGuildId = guildId;
        state.activeChannelId = null;
        state.activeDMId = null;
      }),

    setActiveChannel: (channelId) =>
      set((state) => {
        state.activeChannelId = channelId;
      }),

    setActiveDM: (dmId) =>
      set((state) => {
        state.activeDMId = dmId;
        state.activeGuildId = null;
        state.activeChannelId = null;
      }),

    openModal: (type, props) =>
      set((state) => {
        state.activeModal = props ? { type, props } : { type };
      }),

    closeModal: () =>
      set((state) => {
        state.activeModal = null;
      }),

    toggleMemberSidebar: () =>
      set((state) => {
        state.isMemberSidebarOpen = !state.isMemberSidebarOpen;
      }),

    setMemberSidebarOpen: (open) =>
      set((state) => {
        state.isMemberSidebarOpen = open;
      }),

    openSettings: (page) =>
      set((state) => {
        state.isSettingsOpen = true;
        if (page) state.settingsPage = page;
      }),

    closeSettings: () =>
      set((state) => {
        state.isSettingsOpen = false;
      }),

    setSettingsPage: (page) =>
      set((state) => {
        state.settingsPage = page;
      }),

    toggleMobileNav: () =>
      set((state) => {
        state.isMobileNavOpen = !state.isMobileNavOpen;
      }),

    setMobileNavOpen: (open) =>
      set((state) => {
        state.isMobileNavOpen = open;
      }),

    openServerSettings: (guildId) =>
      set((state) => {
        state.serverSettingsGuildId = guildId;
      }),

    closeServerSettings: () =>
      set((state) => {
        state.serverSettingsGuildId = null;
      }),

    openThread: (threadId) =>
      set((state) => {
        state.activeThreadId = threadId;
      }),

    closeThread: () =>
      set((state) => {
        state.activeThreadId = null;
      }),
  }))
);
