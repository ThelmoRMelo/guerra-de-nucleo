// Valores de balanceamento centralizados — fáceis de ajustar.

export type WeaponId = "pistola" | "metralhadora" | "shotgun" | "rifle" | "sniper";

export interface WeaponDef {
  id: WeaponId;
  nome: string;
  damage: number;
  shots: number; // projéteis por ciclo
  burstDelay: number; // intervalo entre projéteis do ciclo (s)
  cooldown: number; // s
  range: number;
  spread: number; // radianos
  magazine: number;
  reloadTime: number;
  coreMultiplier: number;
  price: { diamond: number } | null;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistola: {
    id: "pistola",
    nome: "PISTOLA",
    damage: 10,
    shots: 1,
    burstDelay: 0,
    cooldown: 1.2,
    range: 45,
    spread: 0.012,
    magazine: 10,
    reloadTime: 1.4,
    coreMultiplier: 1,
    price: null,
  },
  metralhadora: {
    id: "metralhadora",
    nome: "METRALHADORA",
    damage: 8,
    shots: 2,
    burstDelay: 0.18,
    cooldown: 1.5,
    range: 50,
    spread: 0.03,
    magazine: 20,
    reloadTime: 1.8,
    coreMultiplier: 1,
    price: { diamond: 35 },
  },
  shotgun: {
    id: "shotgun",
    nome: "SHOTGUN",
    damage: 5,
    shots: 6,
    burstDelay: 0,
    cooldown: 2.5,
    range: 22,
    spread: 0.1,
    magazine: 8,
    reloadTime: 2.2,
    coreMultiplier: 1.2,
    price: { diamond: 50 },
  },
  rifle: {
    id: "rifle",
    nome: "RIFLE",
    damage: 15,
    shots: 1,
    burstDelay: 0,
    cooldown: 0.8,
    range: 70,
    spread: 0.015,
    magazine: 15,
    reloadTime: 2,
    coreMultiplier: 1.2,
    price: { diamond: 65 },
  },
  sniper: {
    id: "sniper",
    nome: "SNIPER",
    damage: 40,
    shots: 1,
    burstDelay: 0,
    cooldown: 3,
    range: 140,
    spread: 0.004,
    magazine: 5,
    reloadTime: 2.8,
    coreMultiplier: 1.5,
    price: { diamond: 100 },
  },
};

export type UpgradeId = "velocidade" | "armadura" | "regeneracao" | "municao" | "recarga" | "nucleo";

export interface UpgradeDef {
  id: UpgradeId;
  nome: string;
  descricao: string;
  maxLevel: number;
  price: { diamond: number };
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  velocidade: {
    id: "velocidade",
    nome: "VELOCIDADE",
    descricao: "+20% de velocidade por nível",
    maxLevel: 3,
    price: { diamond: 20 },
  },
  armadura: {
    id: "armadura",
    nome: "ARMADURA",
    descricao: "-10% de dano recebido por nível",
    maxLevel: 3,
    price: { diamond: 30 },
  },
  regeneracao: {
    id: "regeneracao",
    nome: "REGENERAÇÃO",
    descricao: "Regenera vida mais rápido",
    maxLevel: 2,
    price: { diamond: 25 },
  },
  municao: {
    id: "municao",
    nome: "MUNIÇÃO",
    descricao: "+50% de capacidade do pente",
    maxLevel: 2,
    price: { diamond: 20 },
  },
  recarga: {
    id: "recarga",
    nome: "RECARGA RÁPIDA",
    descricao: "-20% no tempo de recarga",
    maxLevel: 2,
    price: { diamond: 20 },
  },
  nucleo: {
    id: "nucleo",
    nome: "DANO AO NÚCLEO",
    descricao: "+35% de dano contra núcleos",
    maxLevel: 2,
    price: { diamond: 35 },
  },
};

export type SupplementId = "coxinha" | "bandagem" | "kit_medico" | "energetico";

export interface SupplementDef {
  id: SupplementId;
  nome: string;
  descricao: string;
  emoji: string;
  heal: number;
  speedMultiplier?: number;
  speedDuration?: number;
  price: { diamond: number };
}

/** Consumíveis de uso imediato, disponíveis em qualquer comerciante. */
export const SUPPLEMENTS: Record<SupplementId, SupplementDef> = {
  coxinha: {
    id: "coxinha",
    nome: "COXINHA DE GALINHA",
    descricao: "Recupera 15 de vida",
    emoji: "🍗",
    heal: 15,
    price: { diamond: 15 },
  },
  bandagem: {
    id: "bandagem",
    nome: "BANDAGEM",
    descricao: "Recupera 30 de HP",
    emoji: "🩹",
    heal: 30,
    price: { diamond: 25 },
  },
  kit_medico: {
    id: "kit_medico",
    nome: "KIT MÉDICO",
    descricao: "Recupera 60 de HP",
    emoji: "🧰",
    heal: 60,
    price: { diamond: 45 },
  },
  energetico: {
    id: "energetico",
    nome: "ENERGÉTICO",
    descricao: "Recupera 10 de HP e dá +35% de velocidade por 12s",
    emoji: "⚡",
    heal: 10,
    speedMultiplier: 1.35,
    speedDuration: 12,
    price: { diamond: 20 },
  },
};

export const TUNING = {
  playerMaxHp: 100,
  coreMaxHp: 100,
  moveSpeed: 7.5,
  regenAmount: 5,
  regenInterval: 5,
  regenDelay: 5,
  respawnTime: 5,
  spawnProtection: 3,
  islandRadius: 11,
  islandDistance: 62,
  centerRadius: 19,
  bridgeWidth: 5,
  islandDiamondInterval: 3.5,
  centerGenInterval: 2.5,
  diamondPerPickup: 5,
  coreRestorePrice: 150,
  maxCoreRestorations: 2,
  pickupRadius: 2.2,
  maxPickupsPerNode: 8,
  gravity: 22,
  botReactionRange: 34,
};

export const TEAM_COLORS = [
  "#ff5470",
  "#3fb2ff",
  "#ffc93c",
  "#5ee6a8",
  "#c77dff",
  "#ff9f45",
  "#4dd0e1",
  "#f2f5ff",
];

export const SKINS = [
  { id: "classico", nome: "CLÁSSICO", emoji: "🙂" },
  { id: "raposa", nome: "CACHORRO", emoji: "🐶" },
  { id: "panda", nome: "PANDA", emoji: "🐼" },
  { id: "coruja", nome: "CORUJA", emoji: "🦉" },
  { id: "tigre", nome: "GATO", emoji: "🐱" },
] as const;

export type SkinId = (typeof SKINS)[number]["id"];

export const BOT_NAMES = [
  "Tigre",
  "Kira",
  "Zumbi",
  "Falcão",
  "Nina",
  "Rex",
  "Luna",
  "Vulcão",
  "Pixel",
  "Turbo",
];
