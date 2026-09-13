import { create } from "zustand";
import type { GameEngine } from "./engine";
import type { UpgradeId, WeaponId } from "./config";
import { TEAM_COLORS, type SkinId } from "./config";

export type Screen = "menu" | "howto" | "settings" | "lobby" | "match";
export type BotDifficulty = "facil" | "normal" | "dificil";
export type GraphicsQuality = "ultra" | "baixa" | "media" | "alta";
export type ArenaMap = "nucleo" | "pirata";

const defaultGraphicsQuality: GraphicsQuality = (() => {
  if (typeof navigator === "undefined") return "media";
  const device = navigator as Navigator & { deviceMemory?: number };
  const lowEndDevice = (navigator.hardwareConcurrency || 4) <= 4 || (device.deviceMemory ?? 8) <= 4;
  return window.matchMedia("(pointer: coarse)").matches && lowEndDevice ? "ultra" : "media";
})();

export interface HudSnapshot {
  hp: number;
  coreHp: number;
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
  guidedAimActive: boolean;
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

export interface MatchPlayer {
  playerId: string;
  name: string;
  color: string;
}

interface GameStore {
  screen: Screen;
  playerName: string;
  teamColor: string;
  playerSkin: SkinId;
  botDifficulty: BotDifficulty;
  coreRestorationEnabled: boolean;
  fillEmptySlotsWithBots: boolean;
  teamMode: boolean;
  selectedMap: ArenaMap;
  isRoomHost: boolean;
  roomCode: string;
  shopOpen: boolean;
  emoteOpen: boolean;
  paused: boolean;
  sfxVolume: number;
  musicVolume: number;
  quality: GraphicsQuality;
  sensitivity: number;
  vibration: boolean;
  superPlayerUnlocked: boolean;
  godMode: boolean;
  coreShieldMode: boolean;
  infiniteDiamondsMode: boolean;
  superSpeedMode: boolean;
  guidedAimMode: boolean;
  hud: HudSnapshot | null;
  engine: GameEngine | null;
  matchPlayers: MatchPlayer[];
  matchId: number;
  startMatch: () => void;
  exitToMenu: () => void;
  setScreen: (s: Screen) => void;
  setName: (n: string) => void;
  setTeamColor: (color: string) => void;
  setPlayerSkin: (skin: SkinId) => void;
  setBotDifficulty: (difficulty: BotDifficulty) => void;
  setCoreRestorationEnabled: (enabled: boolean) => void;
  setFillEmptySlotsWithBots: (enabled: boolean) => void;
  setTeamMode: (enabled: boolean) => void;
  setSelectedMap: (map: ArenaMap) => void;
  setIsRoomHost: (isHost: boolean) => void;
  setRoomCode: (c: string) => void;
  setShopOpen: (v: boolean) => void;
  setEmoteOpen: (v: boolean) => void;
  setPaused: (v: boolean) => void;
  unlockSuperPlayer: () => void;
  setGodMode: (enabled: boolean) => void;
  setCoreShieldMode: (enabled: boolean) => void;
  setInfiniteDiamondsMode: (enabled: boolean) => void;
  setSuperSpeedMode: (enabled: boolean) => void;
  setGuidedAimMode: (enabled: boolean) => void;
  setSetting: <K extends keyof GameStore>(k: K, v: GameStore[K]) => void;
  setHud: (h: HudSnapshot) => void;
  setEngine: (e: GameEngine | null) => void;
  setMatchPlayers: (players: MatchPlayer[]) => void;
}

export const useGame = create<GameStore>((set) => ({
  screen: "menu",
  playerName: "Player" + Math.floor(100 + Math.random() * 900),
  teamColor: TEAM_COLORS[0]!,
  playerSkin: "classico",
  botDifficulty: "normal",
  coreRestorationEnabled: true,
  fillEmptySlotsWithBots: true,
  teamMode: false,
  selectedMap: "nucleo",
  isRoomHost: true,
  roomCode: "",
  shopOpen: false,
  emoteOpen: false,
  paused: false,
  sfxVolume: 0.7,
  musicVolume: 0.4,
  quality: defaultGraphicsQuality,
  sensitivity: 1,
  vibration: true,
  superPlayerUnlocked: false,
  godMode: false,
  coreShieldMode: false,
  infiniteDiamondsMode: false,
  superSpeedMode: false,
  guidedAimMode: false,
  hud: null,
  engine: null,
  matchPlayers: [],
  matchId: 0,
  startMatch: () =>
    set((s) => ({ matchId: s.matchId + 1, screen: "match", hud: null, shopOpen: false, emoteOpen: false, paused: false })),
  exitToMenu: () =>
    set({
      screen: "menu",
      hud: null,
      shopOpen: false,
      emoteOpen: false,
      paused: false,
      matchPlayers: [],
      roomCode: "",
      isRoomHost: true,
    }),
  setScreen: (screen) => set({ screen }),
  setName: (playerName) => {
    try {
      localStorage.setItem("nucleo:name", playerName);
    } catch {
      /* ignora */
    }
    set({ playerName });
  },
  setTeamColor: (teamColor) => set({ teamColor }),
  setPlayerSkin: (playerSkin) => set({ playerSkin }),
  setBotDifficulty: (botDifficulty) => set({ botDifficulty }),
  setCoreRestorationEnabled: (coreRestorationEnabled) => set({ coreRestorationEnabled }),
  setFillEmptySlotsWithBots: (fillEmptySlotsWithBots) => set({ fillEmptySlotsWithBots }),
  setTeamMode: (teamMode) => set({ teamMode }),
  setSelectedMap: (selectedMap) => set({ selectedMap }),
  setIsRoomHost: (isRoomHost) => set({ isRoomHost }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setShopOpen: (shopOpen) => set({ shopOpen }),
  setEmoteOpen: (emoteOpen) => set({ emoteOpen }),
  setPaused: (paused) => set({ paused }),
  unlockSuperPlayer: () => set({ superPlayerUnlocked: true }),
  setGodMode: (godMode) => set({ godMode }),
  setCoreShieldMode: (coreShieldMode) => set({ coreShieldMode }),
  setInfiniteDiamondsMode: (infiniteDiamondsMode) => set({ infiniteDiamondsMode }),
  setSuperSpeedMode: (superSpeedMode) => set({ superSpeedMode }),
  setGuidedAimMode: (guidedAimMode) => set({ guidedAimMode }),
  setSetting: (k, v) => set({ [k]: v } as never),
  setHud: (hud) => set({ hud }),
  setEngine: (engine) => set({ engine }),
  setMatchPlayers: (matchPlayers) => set({ matchPlayers }),
}));
