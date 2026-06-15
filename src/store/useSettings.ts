import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Binding } from '../engine/input';
import type { Difficulty } from '../engine/modes';

export interface CustomSpec {
  goodFraction: number;
  greatFraction: number;
  rotationSeconds: number;
  reverseChance: number;
  offCenterChance: number;
  warningLeadMs: number;
  silentChance: number;
}

interface SettingsState {
  bindings: Binding[];
  difficulty: Difficulty;
  volume: number;
  muted: boolean;
  custom: CustomSpec;
  // best scores per (modeId|difficulty)
  bests: Record<string, { bestStreak: number; bestAccuracy: number; lastPlayed: number }>;

  setBindings: (b: Binding[]) => void;
  addBinding: (b: Binding) => void;
  removeBinding: (b: Binding) => void;
  setDifficulty: (d: Difficulty) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setCustom: (patch: Partial<CustomSpec>) => void;
  recordBest: (key: string, streak: number, accuracy: number) => void;
}

const DEFAULT_CUSTOM: CustomSpec = {
  goodFraction: 0.15,
  greatFraction: 0.03,
  rotationSeconds: 1.1,
  reverseChance: 0,
  offCenterChance: 0,
  warningLeadMs: 220,
  silentChance: 0,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      bindings: ['Space'],
      difficulty: 'normal',
      volume: 0.7,
      muted: false,
      custom: DEFAULT_CUSTOM,
      bests: {},

      setBindings: (b) => set({ bindings: b }),
      addBinding: (b) => set((s) => s.bindings.includes(b) ? s : { bindings: [...s.bindings, b] }),
      removeBinding: (b) => set((s) => ({ bindings: s.bindings.filter(x => x !== b) })),
      setDifficulty: (d) => set({ difficulty: d }),
      setVolume: (v) => set({ volume: v }),
      setMuted: (m) => set({ muted: m }),
      setCustom: (patch) => set((s) => ({ custom: { ...s.custom, ...patch } })),
      recordBest: (key, streak, accuracy) => set((s) => {
        const prev = s.bests[key];
        const next = {
          bestStreak: Math.max(prev?.bestStreak ?? 0, streak),
          bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
          lastPlayed: Date.now(),
        };
        return { bests: { ...s.bests, [key]: next } };
      }),
    }),
    { name: 'dbd-skillcheck-trainer:v1' }
  )
);
