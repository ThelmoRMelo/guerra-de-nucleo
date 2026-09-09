import type { UpgradeId, WeaponId } from "./config";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type BotState =
  | "IDLE"
  | "COLETAR"
  | "COMPRAR"
  | "DEFENDER"
  | "ATACAR"
  | "PERSEGUIR"
  | "ATACAR_BASE"
  | "NUCLEO"
  | "REPOSICIONAR"
  | "CENTRO"
  | "FUGIR";

export interface Participant {
  id: string;
  name: string;
  isBot: boolean;
  island: number;
  color: string;
  hp: number;
  alive: boolean;
  eliminated: boolean;
  coreHp: number;
  pos: Vec3;
  vel: Vec3;
  yaw: number;
  moving: boolean;
  walkPhase: number;
  weapon: WeaponId;
  owned: WeaponId[];
  upgrades: Record<UpgradeId, number>;
  diamond: number;
  ammo: number;
  reloadUntil: number;
  nextShotAt: number;
  burstLeft: number;
  nextBurstAt: number;
  lastDamageAt: number;
  nextRegenAt: number;
  respawnAt: number;
  protectedUntil: number;
  kills: number;
  emote: string | null;
  emoteUntil: number;
  botState: BotState;
  botTargetId: string | null;
  botDecisionAt: number;
}

export interface Pickup {
  id: number;
  type: "diamond";
  pos: Vec3;
  spin: number;
}

export interface Tracer {
  id: number;
  from: Vec3;
  to: Vec3;
  born: number;
  color: string;
}

export interface Hit {
  id: number;
  pos: Vec3;
  born: number;
  kind: "player" | "core" | "miss";
}

export interface GameEvent {
  id: number;
  text: string;
  born: number;
}
