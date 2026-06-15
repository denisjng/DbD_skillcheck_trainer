import { create } from 'zustand';

export type Screen = 'menu' | 'modes' | 'settings' | 'playing' | 'results';

interface GameState {
  screen: Screen;
  selectedModeId: string;
  setScreen: (s: Screen) => void;
  setMode: (id: string) => void;
}

export const useGame = create<GameState>((set) => ({
  screen: 'menu',
  selectedModeId: 'classic',
  setScreen: (s) => set({ screen: s }),
  setMode: (id) => set({ selectedModeId: id }),
}));
