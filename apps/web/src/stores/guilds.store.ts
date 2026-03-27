import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  GuildPayload,
  ChannelPayload,
  MemberPayload,
  RolePayload,
} from '@constchat/protocol';

interface GuildsState {
  guilds: Record<string, GuildPayload>;
  channels: Record<string, ChannelPayload>;
  // guildId → userId → member
  members: Record<string, Record<string, MemberPayload>>;
  roles: Record<string, RolePayload>;
  guildOrder: string[];

  // Guild actions
  setGuilds: (guilds: GuildPayload[]) => void;
  setGuild: (guild: GuildPayload) => void;
  updateGuild: (id: string, partial: Partial<GuildPayload>) => void;
  removeGuild: (id: string) => void;

  // Channel actions
  setChannel: (channel: ChannelPayload) => void;
  setChannels: (channels: ChannelPayload[]) => void;
  updateChannel: (id: string, partial: Partial<ChannelPayload>) => void;
  removeChannel: (id: string) => void;

  // Member actions
  setMember: (guildId: string, member: MemberPayload) => void;
  setMembers: (guildId: string, members: MemberPayload[]) => void;
  updateMember: (guildId: string, userId: string, partial: Partial<MemberPayload>) => void;
  removeMember: (guildId: string, userId: string) => void;

  // Role actions
  setRole: (role: RolePayload) => void;
  removeRole: (id: string) => void;

  // Selectors
  getGuildChannels: (guildId: string) => ChannelPayload[];
  getGuildMembers: (guildId: string) => MemberPayload[];
}

export const useGuildsStore = create<GuildsState>()(
  immer((set, get) => ({
    guilds: {},
    channels: {},
    members: {},
    roles: {},
    guildOrder: [],

    setGuilds: (guilds) =>
      set((state) => {
        state.guilds = {};
        state.guildOrder = [];
        state.channels = {};
        state.members = {};
        state.roles = {};
        for (const guild of guilds) {
          state.guilds[guild.id] = guild;
          state.guildOrder.push(guild.id);
          // Index guild channels
          if (guild.channels) {
            for (const channel of guild.channels) {
              state.channels[channel.id] = channel;
            }
          }
          // Index roles
          if (guild.roles) {
            for (const role of guild.roles) {
              state.roles[role.id] = role;
            }
          }
          // Index members
          if (guild.members) {
            if (!state.members[guild.id]) {
              state.members[guild.id] = {};
            }
            const guildMembers = state.members[guild.id]!;
            for (const member of guild.members) {
              guildMembers[member.userId] = member;
            }
          }
        }
      }),

    setGuild: (guild) =>
      set((state) => {
        state.guilds[guild.id] = guild;
        if (!state.guildOrder.includes(guild.id)) {
          state.guildOrder.push(guild.id);
        }
        if (guild.channels) {
          for (const ch of guild.channels) {
            state.channels[ch.id] = ch;
          }
        }
        if (guild.roles) {
          for (const role of guild.roles) {
            state.roles[role.id] = role;
          }
        }
        if (guild.members) {
          if (!state.members[guild.id]) state.members[guild.id] = {};
          const guildMembers = state.members[guild.id]!;
          for (const member of guild.members) {
            guildMembers[member.userId] = member;
          }
        }
      }),

    updateGuild: (id, partial) =>
      set((state) => {
        if (state.guilds[id]) {
          Object.assign(state.guilds[id], partial);
        }
      }),

    removeGuild: (id) =>
      set((state) => {
        delete state.guilds[id];
        state.guildOrder = state.guildOrder.filter((gid) => gid !== id);
        delete state.members[id];
        // Remove channels belonging to this guild
        for (const [chId, ch] of Object.entries(state.channels)) {
          if ((ch as ChannelPayload & { guildId?: string }).guildId === id) {
            delete state.channels[chId];
          }
        }
      }),

    setChannel: (channel) =>
      set((state) => {
        state.channels[channel.id] = channel;
      }),

    setChannels: (channels) =>
      set((state) => {
        for (const ch of channels) {
          state.channels[ch.id] = ch;
        }
      }),

    updateChannel: (id, partial) =>
      set((state) => {
        if (state.channels[id]) {
          Object.assign(state.channels[id], partial);
        }
      }),

    removeChannel: (id) =>
      set((state) => {
        delete state.channels[id];
      }),

    setMember: (guildId, member) =>
      set((state) => {
        if (!state.members[guildId]) state.members[guildId] = {};
        state.members[guildId][member.userId] = member;
      }),

    setMembers: (guildId, members) =>
      set((state) => {
        if (!state.members[guildId]) state.members[guildId] = {};
        for (const member of members) {
          state.members[guildId][member.userId] = member;
        }
      }),

    updateMember: (guildId, userId, partial) =>
      set((state) => {
        if (state.members[guildId]?.[userId]) {
          Object.assign(state.members[guildId][userId], partial);
        }
      }),

    removeMember: (guildId, userId) =>
      set((state) => {
        if (state.members[guildId]) {
          delete state.members[guildId][userId];
        }
      }),

    setRole: (role) =>
      set((state) => {
        state.roles[role.id] = role;
      }),

    removeRole: (id) =>
      set((state) => {
        delete state.roles[id];
      }),

    getGuildChannels: (guildId) => {
      const state = get();
      return Object.values(state.channels).filter(
        (ch) => (ch as ChannelPayload & { guildId?: string }).guildId === guildId
      );
    },

    getGuildMembers: (guildId) => {
      const state = get();
      return Object.values(state.members[guildId] ?? {});
    },
  }))
);
