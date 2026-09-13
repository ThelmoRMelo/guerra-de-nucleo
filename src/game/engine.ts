import {
  BOT_NAMES,
  TEAM_COLORS,
  type SkinId,
  TUNING,
  UPGRADES,
  WEAPONS,
  SUPPLEMENTS,
  type UpgradeId,
  type WeaponId,
  type SupplementId,
} from "./config";
import { CENTER_GEN, ISLANDS, dist2D, isOnGround } from "./world";
import { OBSTACLES } from "./nav";
import type { GameEvent, Hit, Participant, Pickup, Tracer, Vec3 } from "./types";
import {
  ensureBrain,
  resetBotAfterRespawn,
  updateBot,
  type Difficulty,
} from "./bot";

let uid = 1;
const nextId = () => uid++;
const CHARACTER_COLLISION_RADIUS = 0.62;

function emptyUpgrades(): Record<UpgradeId, number> {
  return { velocidade: 0, armadura: 0, regeneracao: 0, municao: 0, recarga: 0, nucleo: 0 };
}

export interface PlayerInput {
  moveX: number; // -1..1 direita
  moveZ: number; // -1..1 frente
  yaw: number; // direção da câmera
  pitch: number;
  /** Direção calculada a partir do centro da câmera (campo de mira). */
  aimYaw: number;
  aimPitch: number;
  /** Ponto projetado pelo auxiliar de mira no centro da câmera. */
  aimTarget: Vec3;
  shooting: boolean;
  reload: boolean;
}

export type MatchStatus = "running" | "victory" | "defeat";

export interface HumanMatchParticipant {
  playerId: string;
  name: string;
  color: string;
  skin?: SkinId;
}

export interface RemotePlayerState {
  player_id: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  yaw: number;
  moving: boolean;
  godMode?: boolean;
}

export class GameEngine {
  time = 0;
  participants: Participant[] = [];
  pickups: Pickup[] = [];
  tracers: Tracer[] = [];
  hits: Hit[] = [];
  events: GameEvent[] = [];
  status: MatchStatus = "running";
  difficulty: Difficulty = "normal";
  /** Regra de sala definida pelo anfitrião: humanos podem restaurar seus núcleos. */
  coreRestorationEnabled = true;
  godMode = false;
  playerId = "p0";
  private genDiamondTimers: number[] = [];
  private centerTimer = 0;
  onEvent?: (text: string) => void;
  onSound?: (name: string) => void;
  /** Emite um acerto causado pelo jogador local contra outro humano da sala. */
  onHumanDamage?: (targetPlayerId: string, amount: number, sourcePlayerId: string) => void;
  /** Emite dano ao núcleo de outro humano para todos os clientes da sala. */
  onHumanCoreDamage?: (targetPlayerId: string, amount: number, sourcePlayerId: string) => void;

  constructor(
    playerName: string,
    otherHumans: HumanMatchParticipant[] = [],
    playerColor = TEAM_COLORS[0]!,
    difficulty: Difficulty = "normal",
    coreRestorationEnabled = true,
    fillEmptySlotsWithBots = true,
    localNetworkPlayerId = "",
    playerSkin: SkinId = "classico",
    godMode = false,
  ) {
    this.difficulty = difficulty;
    this.coreRestorationEnabled = coreRestorationEnabled;
    const localColor = TEAM_COLORS.includes(playerColor) ? playerColor : TEAM_COLORS[0]!;
    // O servidor já garante cores únicas. O motor preserva as cores recebidas e
    // nunca troca silenciosamente a cor de outro humano.
    const humans: HumanMatchParticipant[] = [{ playerId: localNetworkPlayerId, name: playerName, color: localColor, skin: playerSkin }];
    for (const human of otherHumans) {
      if (TEAM_COLORS.includes(human.color) && !humans.some((p) => p.color === human.color)) humans.push(human);
    }
    const humanIslands = humans.map((human) => TEAM_COLORS.indexOf(human.color));
    const botIslands = TEAM_COLORS.map((_, island) => island).filter((island) => !humanIslands.includes(island));
    const botNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const participantCount = fillEmptySlotsWithBots ? 8 : humans.length;
    for (let i = 0; i < participantCount; i++) {
      const human = i < humans.length;
      const island = human ? humanIslands[i]! : botIslands[i - humans.length]!;
      const participant = this.makeParticipant(
          human ? `p${i}` : `bot${i}`,
          human ? humans[i]!.name : botNames[i % botNames.length]!,
          !human,
          island,
          human ? humans[i]!.skin ?? "classico" : (["raposa", "panda", "coruja", "tigre"] as SkinId[])[i % 4]!,
        );
      if (human) participant.networkPlayerId = humans[i]!.playerId;
      this.participants.push(participant);
    }
    for (const p of this.participants) if (p.isBot) ensureBrain(p, p.island);
    if (godMode) this.enableGodMode();
    this.genDiamondTimers = ISLANDS.map(() => Math.random() * 2);
  }

  private makeParticipant(id: string, name: string, isBot: boolean, island: number, skin: SkinId): Participant {
    const isl = ISLANDS[island]!;
    return {
      id,
      name,
      isBot,
      island,
      color: TEAM_COLORS[island]!,
      skin,
      hp: TUNING.playerMaxHp,
      alive: true,
      eliminated: false,
      coreHp: TUNING.coreMaxHp,
      coreRestorations: 0,
      godMode: false,
      pos: { ...isl.spawn },
      vel: { x: 0, y: 0, z: 0 },
      yaw: Math.atan2(Math.cos(isl.angle), Math.sin(isl.angle)),
      moving: false,
      walkPhase: 0,
      weapon: "pistola",
      owned: ["pistola"],
      upgrades: emptyUpgrades(),
      diamond: 0,
      ammo: WEAPONS.pistola.magazine,
      reloadUntil: 0,
      nextShotAt: 0,
      burstLeft: 0,
      nextBurstAt: 0,
      lastDamageAt: -99,
      nextRegenAt: 0,
      respawnAt: 0,
      protectedUntil: TUNING.spawnProtection,
      speedBoostUntil: 0,
      speedBoostMultiplier: 1,
      kills: 0,
      emote: null,
      emoteUntil: 0,
      botState: "COLETAR",
      botTargetId: null,
      botDecisionAt: 0,
    };
  }

  get player(): Participant {
    return this.participants.find((p) => p.id === this.playerId)!;
  }

  /** Ativa benefícios locais antes de a partida começar. */
  enableGodMode() {
    this.godMode = true;
    const p = this.player;
    p.godMode = true;
    p.coreHp = TUNING.coreMaxHp;
    p.hp = TUNING.playerMaxHp;
    p.diamond = 9999;
    p.owned = Object.keys(WEAPONS) as WeaponId[];
    p.weapon = "sniper";
    p.upgrades = Object.fromEntries(
      Object.entries(UPGRADES).map(([id, upgrade]) => [id, upgrade.maxLevel]),
    ) as Record<UpgradeId, number>;
    p.ammo = this.magazineOf(p);
  }

  /** Aplica a posição recebida do dono do personagem, sem afetar o jogador local. */
  applyRemotePlayerState(state: RemotePlayerState) {
    const participant = this.participants.find(
      (p) => !p.isBot && p.id !== this.playerId && p.networkPlayerId === state.player_id,
    );
    if (!participant || participant.eliminated) return;
    // Estados fora da arena nunca são aceitos de outro cliente.
    if (!isOnGround(state.pos_x, state.pos_z)) return;
    const target = { x: state.pos_x, y: state.pos_y, z: state.pos_z };
    // No primeiro pacote, posiciona imediatamente. Nos demais, mantém o
    // pacote como alvo e deixa a interpolação por frame suavizar o trajeto.
    if (!participant.networkTargetPos) {
      participant.pos = { ...target };
      participant.yaw = state.yaw;
    }
    participant.networkTargetPos = target;
    participant.networkTargetYaw = state.yaw;
    participant.moving = state.moving;
    participant.godMode = Boolean(state.godMode);
  }

  /** Replica um dano já confirmado pelo jogador que atirou, sem recalcular armadura. */
  applyNetworkDamage(targetPlayerId: string, amount: number, sourcePlayerId: string) {
    const target = this.participants.find((p) => !p.isBot && p.networkPlayerId === targetPlayerId);
    const source = this.participants.find((p) => !p.isBot && p.networkPlayerId === sourcePlayerId) ?? null;
    if (!target || target.godMode || !target.alive || target.eliminated || target.protectedUntil > this.time) return;
    target.hp = Math.max(0, target.hp - amount);
    target.lastDamageAt = this.time;
    if (target.id === this.playerId) this.onSound?.("hurt");
    if (target.hp <= 0) this.kill(target, source);
  }

  /** Replica dano de núcleo confirmado pelo atirador para todos os participantes. */
  applyNetworkCoreDamage(targetPlayerId: string, amount: number, sourcePlayerId: string) {
    const owner = this.participants.find((p) => !p.isBot && p.networkPlayerId === targetPlayerId);
    if (!owner || owner.godMode || owner.coreHp <= 0) return;
    owner.coreHp = Math.max(0, owner.coreHp - amount);
    if (owner.coreHp <= 0) {
      this.onSound?.("core");
      this.pushEvent(`💥 NÚCLEO DE ${owner.name.toUpperCase()} DESTRUÍDO!`);
    }
  }

  pushEvent(text: string) {
    this.events.push({ id: nextId(), text, born: this.time });
    if (this.events.length > 6) this.events.shift();
    this.onEvent?.(text);
  }

  /** Mostra uma reação para todos os participantes por quatro segundos. */
  sendEmote(p: Participant, emote: string) {
    if (!p.alive || p.eliminated) return;
    p.emote = emote;
    p.emoteUntil = this.time + 4;
  }

  // ---------------------------------------------------------------- loop

  step(dt: number, input: PlayerInput) {
    if (this.status !== "running") return;
    this.time += dt;

    this.updatePlayer(dt, input);
    for (const p of this.participants) {
      if (p.isBot) this.updateBot(dt, p);
      else if (p.id !== this.playerId) this.interpolateRemotePlayer(p, dt);
      this.updateCommon(dt, p);
    }
    this.updateGenerators(dt);
    this.collectPickups();
    this.cleanup();
    this.checkMatchEnd();
  }

  private speedOf(p: Participant) {
    const speedBoost = p.speedBoostUntil > this.time ? p.speedBoostMultiplier : 1;
    return TUNING.moveSpeed * (1 + p.upgrades.velocidade * 0.2) * speedBoost;
  }

  private updatePlayer(dt: number, input: PlayerInput) {
    const p = this.player;
    if (!p.alive) {
      if (input.shooting) p.nextShotAt = this.time; // ignora
      return;
    }
    const len = Math.hypot(input.moveX, input.moveZ);
    let dx = 0;
    let dz = 0;
    if (len > 0.05) {
      const nx = input.moveX / Math.max(len, 1);
      const nz = input.moveZ / Math.max(len, 1);
      const sin = Math.sin(input.yaw);
      const cos = Math.cos(input.yaw);
      // frente da câmera = (-sin, -cos)
      dx = nx * cos - nz * sin;
      dz = -nx * sin - nz * cos;
      p.yaw = input.yaw;
    }
    p.moving = len > 0.05;
    this.moveEntity(p, dx, dz, dt);

    if (input.reload) this.startReload(p);
    if (input.shooting) this.tryShoot(p, input.aimYaw, input.aimPitch, input.aimTarget);
  }

  moveEntity(p: Participant, dx: number, dz: number, dt: number) {
    this.keepInsideArena(p);
    this.resolveObstacleOverlap(p);
    const speed = this.speedOf(p);
    const nx = p.pos.x + dx * speed * dt;
    const nz = p.pos.z + dz * speed * dt;
    if (p.pos.y >= -0.01) {
      // Os eixos são avaliados separadamente para que o personagem deslize
      // ao longo do obstáculo, em vez de atravessá-lo ou parar por completo.
      if (this.canOccupy(p, nx, p.pos.z)) p.pos.x = nx;
      if (this.canOccupy(p, p.pos.x, nz)) p.pos.z = nz;
      if (!isOnGround(p.pos.x, p.pos.z)) p.vel.y = -1;
    } else {
      p.pos.x = nx;
      p.pos.z = nz;
    }
    if (!isOnGround(p.pos.x, p.pos.z)) {
      p.vel.y -= TUNING.gravity * dt;
      p.pos.y += p.vel.y * dt;
      if (p.pos.y < -25) this.kill(p, null, "caiu no vazio");
    } else if (p.pos.y < 0) {
      p.pos.y = Math.min(0, p.pos.y + 12 * dt);
      if (p.pos.y > -0.05) {
        p.pos.y = 0;
        p.vel.y = 0;
      }
    }
    if (p.moving) p.walkPhase += dt * 9;
  }

  private updateCommon(dt: number, p: Participant) {
    if (p.emote && p.emoteUntil <= this.time) p.emote = null;
    if (p.eliminated) return;
    if (!p.alive) {
      if (this.time >= p.respawnAt) this.respawn(p);
      return;
    }
    // regeneração
    if (p.hp < TUNING.playerMaxHp && this.time - p.lastDamageAt >= TUNING.regenDelay) {
      if (this.time >= p.nextRegenAt) {
        p.hp = Math.min(TUNING.playerMaxHp, p.hp + TUNING.regenAmount);
        p.nextRegenAt = this.time + TUNING.regenInterval / (1 + p.upgrades.regeneracao * 0.5);
      }
    } else if (this.time - p.lastDamageAt < TUNING.regenDelay) {
      p.nextRegenAt = this.time + TUNING.regenInterval / (1 + p.upgrades.regeneracao * 0.5);
    }
    // rajadas pendentes
    if (p.burstLeft > 0 && this.time >= p.nextBurstAt) {
      this.fireOnce(p, p.aimYaw ?? p.yaw, p.aimPitch ?? 0);
      p.burstLeft -= 1;
      p.nextBurstAt = this.time + WEAPONS[p.weapon].burstDelay;
    }
    void dt;
  }

  // ---------------------------------------------------------------- combate

  magazineOf(p: Participant) {
    return Math.round(WEAPONS[p.weapon].magazine * (1 + p.upgrades.municao * 0.5));
  }

  startReload(_p: Participant) {
    // Munição infinita: recarga desativada.
  }

  tryShoot(p: Participant, yaw: number, pitch: number, aimTarget?: Vec3) {
    if (!p.alive || this.time < p.nextShotAt || p.burstLeft > 0) return;
    if (p.protectedUntil > this.time && !p.isBot) {
      // proteção de spawn impede causar dano — sai da proteção ao atirar
      p.protectedUntil = 0;
    }
    const w = WEAPONS[p.weapon];
    p.aimYaw = yaw;
    p.aimPitch = pitch;
    if (aimTarget) p.aimTarget = { ...aimTarget };
    else delete p.aimTarget;
    p.nextShotAt = this.time + w.cooldown;
    p.ammo = this.magazineOf(p);
    p.reloadUntil = 0;
    if (w.shots > 1 && w.burstDelay > 0) {
      this.fireOnce(p, yaw, pitch);
      p.burstLeft = w.shots - 1;
      p.nextBurstAt = this.time + w.burstDelay;
    } else {
      for (let i = 0; i < w.shots; i++) this.fireOnce(p, yaw, pitch);
    }
    if (!p.isBot) this.onSound?.("shot");
  }

  private fireOnce(p: Participant, yaw: number, pitch: number) {
    const w = WEAPONS[p.weapon];
    const spread = w.spread + (p.isBot ? 0.03 : 0);
    let aimYaw = yaw;
    let aimPitch = pitch;
    // O disparo nasce no personagem, mas aponta para o mesmo ponto distante
    // indicado pelo raio da mira da câmera. Isso elimina o desvio causado
    // pela câmera no ombro direito/esquerdo.
    if (p.aimTarget) {
      const dx = p.aimTarget.x - p.pos.x;
      const dz = p.aimTarget.z - p.pos.z;
      const horizontalDistance = Math.hypot(dx, dz);
      aimYaw = Math.atan2(-dx, -dz);
      aimPitch = Math.atan2(p.aimTarget.y - (p.pos.y + 1.4), horizontalDistance);
    }
    const y = aimYaw + (Math.random() - 0.5) * spread * 12;
    const pi = aimPitch + (Math.random() - 0.5) * spread * 6;
    const dir = {
      x: -Math.sin(y) * Math.cos(pi),
      y: Math.sin(pi),
      z: -Math.cos(y) * Math.cos(pi),
    };
    const origin: Vec3 = { x: p.pos.x, y: p.pos.y + 1.4, z: p.pos.z };
    const hit = this.raycast(origin, dir, w.range, p);
    const end = hit
      ? hit.point
      : {
          x: origin.x + dir.x * w.range,
          y: origin.y + dir.y * w.range,
          z: origin.z + dir.z * w.range,
        };
    this.tracers.push({
      id: nextId(),
      from: origin,
      to: end,
      born: this.time,
      color: p.color,
      fromLocalPlayer: p.id === this.playerId,
    });
    if (!hit) return;
    if (hit.kind === "player") {
      this.damagePlayer(hit.target as Participant, w.damage, p);
      this.hits.push({ id: nextId(), pos: hit.point, born: this.time, kind: "player" });
    } else {
      const owner = hit.target as Participant;
      const dmg = w.damage * w.coreMultiplier * (1 + p.upgrades.nucleo * 0.35);
      this.damageCore(owner, dmg, p);
      this.hits.push({ id: nextId(), pos: hit.point, born: this.time, kind: "core" });
    }
  }

  private raycast(origin: Vec3, dir: Vec3, range: number, shooter: Participant) {
    let best: { dist: number; point: Vec3; kind: "player" | "core"; target: Participant } | null =
      null;
    const consider = (dist: number, kind: "player" | "core", target: Participant) => {
      if (dist < 0 || dist > range) return;
      if (best && best.dist <= dist) return;
      best = {
        dist,
        kind,
        target,
        point: {
          x: origin.x + dir.x * dist,
          y: origin.y + dir.y * dist,
          z: origin.z + dir.z * dist,
        },
      };
    };
    for (const o of this.participants) {
      if (o.id !== shooter.id && !o.godMode && o.alive && !o.eliminated && o.protectedUntil < this.time) {
        const d = raySphere(origin, dir, { x: o.pos.x, y: o.pos.y + 1.1, z: o.pos.z }, 1.0);
        if (d !== null) consider(d, "player", o);
      }
      if (o.id !== shooter.id && !o.godMode && o.coreHp > 0) {
        const core = ISLANDS[o.island]!.core;
        const d = raySphere(origin, dir, { x: core.x, y: 1.5, z: core.z }, 1.7);
        if (d !== null) consider(d, "core", o);
      }
    }
    return best as {
      dist: number;
      point: Vec3;
      kind: "player" | "core";
      target: Participant;
    } | null;
  }

  damagePlayer(target: Participant, amount: number, from: Participant) {
    if (target.godMode || !target.alive || target.eliminated) return;
    if (target.protectedUntil > this.time) return;
    const reduced = amount * (1 - target.upgrades.armadura * 0.1);
    target.hp = Math.max(0, target.hp - reduced);
    target.lastDamageAt = this.time;
    if (target.id === this.playerId) this.onSound?.("hurt");
    // O atirador local é quem detecta o raio. Repasse exatamente o dano já
    // reduzido para que todos os clientes exibam a mesma vida do alvo.
    if (
      from.id === this.playerId &&
      !target.isBot &&
      target.networkPlayerId &&
      from.networkPlayerId
    ) {
      this.onHumanDamage?.(target.networkPlayerId, reduced, from.networkPlayerId);
    }
    if (target.hp <= 0) this.kill(target, from);
  }

  /** Suaviza pacotes de rede de 10 Hz para a taxa de quadros da tela. */
  private interpolateRemotePlayer(p: Participant, dt: number) {
    const target = p.networkTargetPos;
    if (!target) return;
    const alpha = 1 - Math.exp(-18 * dt);
    p.pos.x += (target.x - p.pos.x) * alpha;
    p.pos.y += (target.y - p.pos.y) * alpha;
    p.pos.z += (target.z - p.pos.z) * alpha;
    if (p.networkTargetYaw !== undefined) {
      const angle = Math.atan2(Math.sin(p.networkTargetYaw - p.yaw), Math.cos(p.networkTargetYaw - p.yaw));
      p.yaw += angle * alpha;
    }
    if (p.moving) p.walkPhase += dt * 9;
  }

  private canOccupy(p: Participant, x: number, z: number) {
    // A borda de cada ilha, ponte e plataforma central é uma barreira invisível.
    // Nunca aceitamos um passo fora do chão jogável, evitando quedas no vazio.
    if (!isOnGround(x, z)) return false;
    return !OBSTACLES.some((obstacle) => Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.r + CHARACTER_COLLISION_RADIUS);
  }

  /** Recupera com segurança entidades que estavam fora da arena antes da barreira existir. */
  private keepInsideArena(p: Participant) {
    if (p.pos.y >= -0.01 && isOnGround(p.pos.x, p.pos.z)) return;
    const spawn = ISLANDS[p.island]!.spawn;
    p.pos = { ...spawn };
    p.vel = { x: 0, y: 0, z: 0 };
    p.moving = false;
  }

  /** Expulsa com suavidade personagens que já estavam dentro de um prop ao carregar a correção. */
  private resolveObstacleOverlap(p: Participant) {
    if (p.pos.y < -0.01) return;
    for (const obstacle of OBSTACLES) {
      const dx = p.pos.x - obstacle.x;
      const dz = p.pos.z - obstacle.z;
      const distance = Math.hypot(dx, dz);
      const minDistance = obstacle.r + CHARACTER_COLLISION_RADIUS;
      if (distance >= minDistance) continue;
      const nx = distance > 0.001 ? dx / distance : Math.cos(p.yaw);
      const nz = distance > 0.001 ? dz / distance : Math.sin(p.yaw);
      p.pos.x = obstacle.x + nx * minDistance;
      p.pos.z = obstacle.z + nz * minDistance;
    }
  }

  damageCore(owner: Participant, amount: number, from: Participant) {
    if (owner.godMode || owner.coreHp <= 0) return;
    owner.coreHp = Math.max(0, owner.coreHp - amount);
    if (
      from.id === this.playerId &&
      !owner.isBot &&
      owner.networkPlayerId &&
      from.networkPlayerId
    ) {
      this.onHumanCoreDamage?.(owner.networkPlayerId, amount, from.networkPlayerId);
    }
    if (owner.coreHp <= 0) {
      this.onSound?.("core");
      this.pushEvent(`💥 NÚCLEO DE ${owner.name.toUpperCase()} DESTRUÍDO!`);
      void from;
    }
  }

  kill(target: Participant, from: Participant | null, reason?: string) {
    if (!target.alive) return;
    target.alive = false;
    target.hp = 0;
    target.vel = { x: 0, y: 0, z: 0 };
    if (from) from.kills += 1;
    if (target.coreHp <= 0) {
      target.eliminated = true;
      this.pushEvent(
        `☠ ${target.name} FOI ELIMINADO${from ? ` por ${from.name}` : reason ? ` (${reason})` : ""}`,
      );
    } else {
      target.respawnAt = this.time + TUNING.respawnTime;
      this.pushEvent(
        `${from ? `${from.name} eliminou ` : ""}${target.name}${from ? "" : " morreu"}`,
      );
    }
  }

  respawn(p: Participant) {
    if (p.coreHp <= 0) {
      p.eliminated = true;
      return;
    }
    const isl = ISLANDS[p.island]!;
    // Bots ressurgem no ponto central livre da própria ilha. O spawn externo
    // fica atrás da base do núcleo e, com colisão ativa, podia prendê-los.
    p.pos = p.isBot ? { ...isl.center } : { ...isl.spawn };
    p.vel = { x: 0, y: 0, z: 0 };
    p.hp = TUNING.playerMaxHp;
    p.alive = true;
    p.protectedUntil = this.time + TUNING.spawnProtection;
    p.speedBoostUntil = 0;
    p.speedBoostMultiplier = 1;
    p.ammo = this.magazineOf(p);
    p.reloadUntil = 0;
    p.burstLeft = 0;
    if (p.isBot) resetBotAfterRespawn(this, p, this.time);
    if (p.id === this.playerId) this.onSound?.("respawn");
  }

  // ---------------------------------------------------------------- recursos

  private updateGenerators(dt: number) {
    for (let i = 0; i < ISLANDS.length; i++) {
      const owner = this.participants.find((p) => p.island === i);
      if (!owner || owner.eliminated) continue;
      this.genDiamondTimers[i]! -= dt;
      if (this.genDiamondTimers[i]! <= 0) {
        this.genDiamondTimers[i] = TUNING.islandDiamondInterval;
        this.spawnPickup("diamond", ISLANDS[i]!.generator);
      }
    }
    this.centerTimer -= dt;
    if (this.centerTimer <= 0) {
      this.centerTimer = TUNING.centerGenInterval;
      this.spawnPickup("diamond", CENTER_GEN, 6);
    }
  }

  private spawnPickup(type: "diamond", at: Vec3, spread = 2.6) {
    const near = this.pickups.filter((p) => dist2D(p.pos, at) < spread + 2);
    if (near.length >= TUNING.maxPickupsPerNode) return;
    const a = Math.random() * Math.PI * 2;
    const r = 1.5 + Math.random() * spread;
    this.pickups.push({
      id: nextId(),
      type,
      pos: { x: at.x + Math.cos(a) * r, y: 0.7, z: at.z + Math.sin(a) * r },
      spin: Math.random() * Math.PI,
    });
  }

  private collectPickups() {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i]!;
      for (const p of this.participants) {
        if (!p.alive || p.eliminated) continue;
        if (dist2D(p.pos, pk.pos) < TUNING.pickupRadius) {
          p.diamond += TUNING.diamondPerPickup;
          if (p.id === this.playerId) this.onSound?.("diamond");
          this.pickups.splice(i, 1);
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------- loja

  canBuyWeapon(p: Participant, id: WeaponId) {
    const w = WEAPONS[id];
    if (!w.price || p.owned.includes(id)) return false;
    return p.diamond >= w.price.diamond;
  }

  buyWeapon(p: Participant, id: WeaponId): boolean {
    if (!this.canBuyWeapon(p, id)) return false;
    const price = WEAPONS[id].price!;
    p.diamond -= price.diamond;
    p.owned.push(id);
    p.weapon = id;
    p.ammo = this.magazineOf(p);
    if (p.id === this.playerId) this.onSound?.("buy");
    return true;
  }

  buyUpgrade(p: Participant, id: UpgradeId): boolean {
    const u = UPGRADES[id];
    const level = p.upgrades[id];
    if (level >= u.maxLevel) return false;
    const cost = { diamond: u.price.diamond * (level + 1) };
    if (p.diamond < cost.diamond) return false;
    p.diamond -= cost.diamond;
    p.upgrades[id] = level + 1;
    if (p.id === this.playerId) this.onSound?.("buy");
    return true;
  }

  upgradeCost(p: Participant, id: UpgradeId) {
    const u = UPGRADES[id];
    const level = p.upgrades[id];
    return { diamond: u.price.diamond * (level + 1) };
  }

  canBuySupplement(p: Participant, id: SupplementId) {
    const supplement = SUPPLEMENTS[id];
    const canUseEffect = p.hp < TUNING.playerMaxHp || supplement.speedDuration !== undefined;
    return p.alive && !p.eliminated && canUseEffect && p.diamond >= supplement.price.diamond;
  }

  buySupplement(p: Participant, id: SupplementId): boolean {
    if (!this.canBuySupplement(p, id)) return false;
    const supplement = SUPPLEMENTS[id];
    p.diamond -= supplement.price.diamond;
    p.hp = Math.min(TUNING.playerMaxHp, p.hp + supplement.heal);
    if (supplement.speedDuration) {
      p.speedBoostUntil = this.time + supplement.speedDuration;
      p.speedBoostMultiplier = supplement.speedMultiplier ?? 1;
    }
    if (p.id === this.playerId) this.onSound?.("buy");
    return true;
  }

  equip(p: Participant, id: WeaponId) {
    if (!p.owned.includes(id)) return;
    p.weapon = id;
    p.ammo = this.magazineOf(p);
    p.reloadUntil = 0;
  }

  // ---------------------------------------------------------------- bots

  private updateBot(dt: number, b: Participant) {
    updateBot(this, b, dt);
  }

  // ---------------------------------------------------------------- fim

  private cleanup() {
    this.tracers = this.tracers.filter(
      (t) => this.time - t.born < (t.fromLocalPlayer ? 0.16 : 0.09),
    );
    this.hits = this.hits.filter((h) => this.time - h.born < 0.35);
    this.events = this.events.filter((e) => this.time - e.born < 5);
  }

  private checkMatchEnd() {
    const alive = this.participants.filter((p) => !p.eliminated);
    if (alive.length <= 1) {
      const winner = alive[0];
      this.status = winner && winner.id === this.playerId ? "victory" : "defeat";
      this.onSound?.(this.status === "victory" ? "victory" : "defeat");
      return;
    }
    if (this.player.eliminated) this.status = "defeat";
  }

  nearShop(p: Participant) {
    // Comerciantes são neutros: qualquer participante pode comprar em qualquer ilha.
    return ISLANDS.some((island) => dist2D(p.pos, island.shop) < 4.5);
  }

  canRestoreCore(p: Participant) {
    return (
      this.coreRestorationEnabled &&
      !p.isBot &&
      p.alive &&
      !p.eliminated &&
      p.coreHp <= 0 &&
      p.coreRestorations < TUNING.maxCoreRestorations &&
      p.diamond >= TUNING.coreRestorePrice
    );
  }

  restoreCore(p: Participant): boolean {
    if (!this.canRestoreCore(p)) return false;
    p.diamond -= TUNING.coreRestorePrice;
    p.coreHp = TUNING.coreMaxHp;
    p.coreRestorations += 1;
    this.pushEvent(`✨ ${p.name} RESTAUROU O NÚCLEO!`);
    if (p.id === this.playerId) this.onSound?.("buy");
    return true;
  }
}

declare module "./types" {
  interface Participant {
    aimYaw?: number;
    aimPitch?: number;
    aimTarget?: Vec3;
  }
}

function raySphere(origin: Vec3, dir: Vec3, center: Vec3, radius: number): number | null {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const b = 2 * (ox * dir.x + oy * dir.y + oz * dir.z);
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / 2;
  const t2 = (-b + s) / 2;
  if (t1 >= 0) return t1;
  if (t2 >= 0) return t2;
  return null;
}
