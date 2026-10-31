import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setMuted } from './fx/audio';
import type { ToolId } from './game/data/upgrades';
import { newGame } from './game/run';
import { SAVE_VERSION, type Game } from './game/state';

interface GameStore {
  game: Game;
  muted: boolean;
  /** Runs a pure game function on a copy of the state and commits it. */
  act: <T>(fn: (g: Game) => T) => T;
  setMuted: (m: boolean) => void;
  hardReset: () => void;
  exportSave: () => string;
  importSave: (s: string) => boolean;
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      game: newGame(),
      muted: false,
      act: (fn) => {
        const g = structuredClone(get().game);
        const r = fn(g);
        set({ game: g });
        return r;
      },
      setMuted: (m) => {
        setMuted(m);
        set({ muted: m });
      },
      hardReset: () => set({ game: newGame() }),
      exportSave: () => btoa(unescape(encodeURIComponent(JSON.stringify(get().game)))),
      importSave: (s) => {
        try {
          const g = JSON.parse(decodeURIComponent(escape(atob(s.trim())))) as Game;
          if (g.v !== SAVE_VERSION || !g.meta || !g.run) return false;
          set({ game: g });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'deep-debt-save',
      version: SAVE_VERSION,
      partialize: (s) => ({ game: s.game, muted: s.muted }),
      onRehydrateStorage: () => (s) => s && setMuted(s.muted),
    },
  ),
);

export type ToastKind = 'info' | 'good' | 'bad' | 'gold';
export interface Toast {
  id: number;
  text: string;
  kind: ToastKind;
}

export type ModalId = 'collection' | 'legacy' | 'settings' | 'help' | null;

interface UiStore {
  tool: ToolId | null;
  /** While a Saloon animation plays, the HUD shows this instead of the real cash, so the result isn't spoiled. */
  heldCash: number | null;
  liveCombo: number;
  showSummary: boolean;
  modal: ModalId;
  toasts: Toast[];
}

export const useUi = create<UiStore>()(() => ({
  tool: null,
  heldCash: null,
  liveCombo: 0,
  showSummary: false,
  modal: null,
  toasts: [],
}));

let toastId = 0;
export function toast(text: string, kind: ToastKind = 'info') {
  const id = ++toastId;
  useUi.setState((s) => ({ toasts: [...s.toasts.slice(-4), { id, text, kind }] }));
  setTimeout(() => useUi.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2800);
}
