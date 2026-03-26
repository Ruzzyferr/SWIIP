import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { RelationshipPayload } from '@/lib/api/friends.api';

interface FriendsState {
  relationships: RelationshipPayload[];
  isLoaded: boolean;

  // Actions
  setRelationships: (relationships: RelationshipPayload[]) => void;
  addRelationship: (relationship: RelationshipPayload) => void;
  removeRelationship: (userId: string) => void;
  updateRelationship: (userId: string, partial: Partial<RelationshipPayload>) => void;
}

export const useFriendsStore = create<FriendsState>()(
  immer((set) => ({
    relationships: [],
    isLoaded: false,

    setRelationships: (relationships) =>
      set((state) => {
        state.relationships = relationships;
        state.isLoaded = true;
      }),

    addRelationship: (relationship) =>
      set((state) => {
        const idx = state.relationships.findIndex((r) => r.user.id === relationship.user.id);
        if (idx >= 0) {
          state.relationships[idx] = relationship;
        } else {
          state.relationships.push(relationship);
        }
      }),

    removeRelationship: (userId) =>
      set((state) => {
        state.relationships = state.relationships.filter((r) => r.user.id !== userId);
      }),

    updateRelationship: (userId, partial) =>
      set((state) => {
        const rel = state.relationships.find((r) => r.user.id === userId);
        if (rel) {
          Object.assign(rel, partial);
        }
      }),
  }))
);
