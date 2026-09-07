import { create } from "zustand";
import type { GameEngine } from "./engine";
import type { UpgradeId, WeaponId } from "./config";

export type Screen = "menu" | "howto" | "settings" | "lobby" | "match";

export interface HudSnapshot {
  hp: number;
  coreHp: number;
  iron: number;
  diamond: number;
  weapon: WeaponId;
  owned: WeaponId[];
  upgrades: Record<UpgradeId, number>;
  ammo: number;
  magazine: number;
  reloading: boolean;
  alive: boolean;
  eliminated: boolean;
  protectedNow: boolean;
  respawnIn: number;
  nearShop: boolean;
  events: string[];
  scoreboard: {
    id: string;
    name: string;
    color: string;
    coreHp: number;
    eliminated: boolean;
    isBot: boolean;
    kills: number;
  }[];
  status: "running" | "victory" | "defeat";
}

interface GameStore {
  screen: Screen;
  playerName: string;
  roomCode: string;
  shopOpen: boolean;
  paused: boolean;
  sfxVolume: number;
  musicVolume: number;
  quality: "baixa" | "media" | "alta";
  sensitivity: number;
  vibration: boolean;
  hud: HudSnapshot | null;
  engine: GameEngine | null;
  matchId: number;
  startMatch: () => void;
  exitToMenu: () => void;
  setScreen: (s: Screen) => void;
  setName: (n: string) => void;
  setRoomCode: (c: string) => void;
  setShopOpen: (v: boolean) => void;
  setPaused: (v: boolean) => void;
  setSetting: <K extends keyof GameStore>(k: K, v: GameStore[K]) => void;
  setHud: (h: HudSnapshot) => void;
  setEngine: (e: GameEngine | null) => void;
}

export const useGame = create<GameStore>((set) => ({
  screen: "menu",
  playerName: "Player" + Math.floor(100 + Math.random() * 900),
  roomCode: "",
  shopOpen: false,
  paused: false,
  sfxVolume: 0.7,
  musicVolume: 0.4,
  quality: "media",
  sensitivity: 1,
  vibration: true,
  hud: null,
  engine: null,
  matchId: 0,
  startMatch: () =>
    set((s) => ({ matchId: s.matchId + 1, screen: "match", hud: null, shopOpen: false, paused: false })),
  exitToMenu: () => set({ screen: "menu", hud: null, shopOpen: false, paused: false }),
  setScreen: (screen) => set({ screen }),
  setName: (playerName) => {
    try {
      localStorage.setItem("nucleo:name", playerName);
    } catch {
      /* ignora */
    }
    set({ playerName });
  },
  setRoomCode: (roomCode) => set({ roomCode }),
  setShopOpen: (shopOpen) => set({ shopOpen }),
  setPaused: (paused) => set({ paused }),
  setSetting: (k, v) => set({ [k]: v } as never),
  setHud: (hud) => set({ hud }),
  setEngine: (engine) => set({ engine }),
}));
