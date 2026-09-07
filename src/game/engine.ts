import {
  BOT_NAMES,
  TEAM_COLORS,
  TUNING,
  UPGRADES,
  WEAPONS,
  type UpgradeId,
  type WeaponId,
} from "./config";
import { CENTER_GEN, ISLANDS, dist2D, isOnGround, randomPointOnIsland } from "./world";
import type { GameEvent, Hit, Participant, Pickup, Tracer, Vec3 } from "./types";

let uid = 1;
const nextId = () => uid++;

function emptyUpgrades(): Record<UpgradeId, number> {
  return { velocidade: 0, armadura: 0, regeneracao: 0, municao: 0, recarga: 0, nucleo: 0 };
}

export interface PlayerInput {
  moveX: number; // -1..1 direita
  moveZ: number; // -1..1 frente
  yaw: number; // direção da câmera
  pitch: number;
  shooting: boolean;
  reload: boolean;
}

export type MatchStatus = "running" | "victory" | "defeat";

export class GameEngine {
  time = 0;
  participants: Participant[] = [];
  pickups: Pickup[] = [];
  tracers: Tracer[] = [];
  hits: Hit[] = [];
  events: GameEvent[] = [];
  status: MatchStatus = "running";
  playerId = "p0";
  private genTimers: number[] = [];
  private genDiamondTimers: number[] = [];
  private centerTimer = 0;
  onEvent?: (text: string) => void;
  onSound?: (name: string) => void;

  constructor(playerName: string, humanNames: string[] = []) {
    const names = [playerName, ...humanNames];
    const order = [0, 1, 2, 3, 4, 5, 6, 7];
    const botNames = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 8; i++) {
      const human = i < names.length;
      this.participants.push(
        this.makeParticipant(
          human ? `p${i}` : `bot${i}`,
          human ? names[i]! : botNames[i % botNames.length]!,
          !human,
          order[i]!,
        ),
      );
    }
    this.genTimers = ISLANDS.map(() => Math.random() * 2);
    this.genDiamondTimers = ISLANDS.map(() => Math.random() * 6);
  }

  private makeParticipant(id: string, name: string, isBot: boolean, island: number): Participant {
    const isl = ISLANDS[island]!;
    return {
      id,
      name,
      isBot,
      island,
      color: TEAM_COLORS[island]!,
      hp: TUNING.playerMaxHp,
      alive: true,
      eliminated: false,
      coreHp: TUNING.coreMaxHp,
      pos: { ...isl.spawn },
      vel: { x: 0, y: 0, z: 0 },
      yaw: Math.atan2(Math.cos(isl.angle), Math.sin(isl.angle)),
      moving: false,
      walkPhase: 0,
      weapon: "pistola",
      owned: ["pistola"],
      upgrades: emptyUpgrades(),
      iron: 0,
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
      kills: 0,
      botState: "COLETAR",
      botTargetId: null,
      botDecisionAt: 0,
    };
  }

  get player(): Participant {
    return this.participants.find((p) => p.id === this.playerId)!;
  }

  pushEvent(text: string) {
    this.events.push({ id: nextId(), text, born: this.time });
    if (this.events.length > 6) this.events.shift();
    this.onEvent?.(text);
  }

  // ---------------------------------------------------------------- loop

  step(dt: number, input: PlayerInput) {
    if (this.status !== "running") return;
    this.time += dt;

    this.updatePlayer(dt, input);
    for (const p of this.participants) {
      if (p.isBot) this.updateBot(dt, p);
      this.updateCommon(dt, p);
    }
    this.updateGenerators(dt);
    this.collectPickups();
    this.cleanup();
    this.checkMatchEnd();
  }

  private speedOf(p: Participant) {
    return TUNING.moveSpeed * (1 + p.upgrades.velocidade * 0.1);
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
    if (input.shooting) this.tryShoot(p, input.yaw, input.pitch);
  }

  private moveEntity(p: Participant, dx: number, dz: number, dt: number) {
    const speed = this.speedOf(p);
    const nx = p.pos.x + dx * speed * dt;
    const nz = p.pos.z + dz * speed * dt;
    if (p.pos.y >= -0.01) {
      if (isOnGround(nx, p.pos.z)) p.pos.x = nx;
      if (isOnGround(p.pos.x, nz)) p.pos.z = nz;
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

  tryShoot(p: Participant, yaw: number, pitch: number) {
    if (!p.alive || this.time < p.nextShotAt || p.burstLeft > 0) return;
    if (p.protectedUntil > this.time && !p.isBot) {
      // proteção de spawn impede causar dano — sai da proteção ao atirar
      p.protectedUntil = 0;
    }
    const w = WEAPONS[p.weapon];
    p.aimYaw = yaw;
    p.aimPitch = pitch;
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
    const y = yaw + (Math.random() - 0.5) * spread * 12;
    const pi = pitch + (Math.random() - 0.5) * spread * 6;
    const dir = {
      x: -Math.sin(y) * Math.cos(pi),
      y: Math.sin(pi),
      z: -Math.cos(y) * Math.cos(pi),
    };
    const origin: Vec3 = { x: p.pos.x, y: p.pos.y + 1.4, z: p.pos.z };
    const hit = this.raycast(origin, dir, w.range, p);
    const end = hit
      ? hit.point
      : { x: origin.x + dir.x * w.range, y: origin.y + dir.y * w.range, z: origin.z + dir.z * w.range };
    this.tracers.push({ id: nextId(), from: origin, to: end, born: this.time, color: p.color });
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
    let best: { dist: number; point: Vec3; kind: "player" | "core"; target: Participant } | null = null;
    const consider = (dist: number, kind: "player" | "core", target: Participant) => {
      if (dist < 0 || dist > range) return;
      if (best && best.dist <= dist) return;
      best = {
        dist,
        kind,
        target,
        point: { x: origin.x + dir.x * dist, y: origin.y + dir.y * dist, z: origin.z + dir.z * dist },
      };
    };
    for (const o of this.participants) {
      if (o.id !== shooter.id && o.alive && !o.eliminated && o.protectedUntil < this.time) {
        const d = raySphere(origin, dir, { x: o.pos.x, y: o.pos.y + 1.1, z: o.pos.z }, 1.0);
        if (d !== null) consider(d, "player", o);
      }
      if (o.id !== shooter.id && o.coreHp > 0) {
        const core = ISLANDS[o.island]!.core;
        const d = raySphere(origin, dir, { x: core.x, y: 1.5, z: core.z }, 1.7);
        if (d !== null) consider(d, "core", o);
      }
    }
    return best as { dist: number; point: Vec3; kind: "player" | "core"; target: Participant } | null;
  }

  damagePlayer(target: Participant, amount: number, from: Participant) {
    if (!target.alive || target.eliminated) return;
    if (target.protectedUntil > this.time) return;
    const reduced = amount * (1 - target.upgrades.armadura * 0.1);
    target.hp = Math.max(0, target.hp - reduced);
    target.lastDamageAt = this.time;
    if (target.id === this.playerId) this.onSound?.("hurt");
    if (target.hp <= 0) this.kill(target, from);
  }

  damageCore(owner: Participant, amount: number, from: Participant) {
    if (owner.coreHp <= 0) return;
    owner.coreHp = Math.max(0, owner.coreHp - amount);
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
      this.pushEvent(`${from ? `${from.name} eliminou ` : ""}${target.name}${from ? "" : " morreu"}`);
    }
  }

  respawn(p: Participant) {
    if (p.coreHp <= 0) {
      p.eliminated = true;
      return;
    }
    const isl = ISLANDS[p.island]!;
    p.pos = { ...isl.spawn };
    p.vel = { x: 0, y: 0, z: 0 };
    p.hp = TUNING.playerMaxHp;
    p.alive = true;
    p.protectedUntil = this.time + TUNING.spawnProtection;
    p.ammo = this.magazineOf(p);
    p.reloadUntil = 0;
    p.burstLeft = 0;
    if (p.id === this.playerId) this.onSound?.("respawn");
  }

  // ---------------------------------------------------------------- recursos

  private updateGenerators(dt: number) {
    for (let i = 0; i < ISLANDS.length; i++) {
      const owner = this.participants.find((p) => p.island === i);
      if (!owner || owner.eliminated) continue;
      this.genTimers[i]! -= dt;
      if (this.genTimers[i]! <= 0) {
        this.genTimers[i] = TUNING.islandGenInterval;
        this.spawnPickup("iron", ISLANDS[i]!.generator);
      }
      this.genDiamondTimers[i]! -= dt;
      if (this.genDiamondTimers[i]! <= 0) {
        this.genDiamondTimers[i] = TUNING.islandDiamondInterval;
        this.spawnPickup("diamond", ISLANDS[i]!.generator);
      }
    }
    this.centerTimer -= dt;
    if (this.centerTimer <= 0) {
      this.centerTimer = TUNING.centerGenInterval;
      this.spawnPickup(Math.random() < 0.75 ? "diamond" : "iron", CENTER_GEN, 6);
    }
  }

  private spawnPickup(type: "iron" | "diamond", at: Vec3, spread = 2.6) {
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
          if (pk.type === "iron") p.iron += 1;
          else p.diamond += 1;
          if (p.id === this.playerId) this.onSound?.(pk.type === "iron" ? "iron" : "diamond");
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
    return p.iron >= w.price.iron && p.diamond >= w.price.diamond;
  }

  buyWeapon(p: Participant, id: WeaponId): boolean {
    if (!this.canBuyWeapon(p, id)) return false;
    const price = WEAPONS[id].price!;
    p.iron -= price.iron;
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
    const cost = { iron: u.price.iron * (level + 1), diamond: u.price.diamond * (level + 1) };
    if (p.iron < cost.iron || p.diamond < cost.diamond) return false;
    p.iron -= cost.iron;
    p.diamond -= cost.diamond;
    p.upgrades[id] = level + 1;
    if (p.id === this.playerId) this.onSound?.("buy");
    return true;
  }

  upgradeCost(p: Participant, id: UpgradeId) {
    const u = UPGRADES[id];
    const level = p.upgrades[id];
    return { iron: u.price.iron * (level + 1), diamond: u.price.diamond * (level + 1) };
  }

  equip(p: Participant, id: WeaponId) {
    if (!p.owned.includes(id)) return;
    p.weapon = id;
    p.ammo = this.magazineOf(p);
    p.reloadUntil = 0;
  }

  // ---------------------------------------------------------------- bots

  private updateBot(dt: number, b: Participant) {
    if (!b.alive || b.eliminated) return;
    const isl = ISLANDS[b.island]!;

    if (this.time >= b.botDecisionAt) {
      b.botDecisionAt = this.time + 0.6 + Math.random() * 0.8;
      const enemy = this.nearestEnemy(b, TUNING.botReactionRange);
      const coreUnderAttack = b.coreHp > 0 && b.coreHp < TUNING.coreMaxHp;
      if (b.hp < 35 && enemy) b.botState = "FUGIR";
      else if (enemy) {
        b.botState = "ATACAR";
        b.botTargetId = enemy.id;
      } else if (coreUnderAttack && dist2D(b.pos, isl.core) > 18 && Math.random() < 0.5)
        b.botState = "DEFENDER";
      else if (this.botWants(b)) b.botState = "COMPRAR";
      else if (b.iron > 60 || Math.random() < 0.35) b.botState = "CENTRO";
      else b.botState = "COLETAR";
    }

    let target: Vec3 | null = null;
    let shootAt: Vec3 | null = null;

    switch (b.botState) {
      case "FUGIR": {
        const e = this.nearestEnemy(b, 60);
        if (e) {
          target = {
            x: b.pos.x + (b.pos.x - e.pos.x),
            y: 0,
            z: b.pos.z + (b.pos.z - e.pos.z),
          };
          if (!isOnGround(target.x, target.z)) target = isl.spawn;
        } else target = isl.spawn;
        break;
      }
      case "ATACAR": {
        const e = this.participants.find((p) => p.id === b.botTargetId);
        if (e && e.alive && !e.eliminated) {
          const d = dist2D(b.pos, e.pos);
          const w = WEAPONS[b.weapon];
          if (d > w.range * 0.6) target = e.pos;
          else if (d < 6) target = { x: b.pos.x - (e.pos.x - b.pos.x), y: 0, z: b.pos.z - (e.pos.z - b.pos.z) };
          shootAt = { x: e.pos.x, y: e.pos.y + 1.1, z: e.pos.z };
        } else b.botState = "COLETAR";
        break;
      }
      case "DEFENDER":
        target = isl.core;
        break;
      case "COMPRAR":
        target = isl.shop;
        if (dist2D(b.pos, isl.shop) < 4) {
          this.botBuy(b);
          b.botState = "COLETAR";
        }
        break;
      case "CENTRO": {
        const pk = this.nearestPickup(b, true);
        target = pk ? pk.pos : CENTER_GEN;
        // ataca núcleo inimigo próximo quando estiver longe de casa
        const enemyCore = this.nearestEnemyCore(b, 26);
        if (enemyCore) {
          const core = ISLANDS[enemyCore.island]!.core;
          target = core;
          if (dist2D(b.pos, core) < 20) shootAt = { x: core.x, y: 1.5, z: core.z };
        }
        break;
      }
      default: {
        const pk = this.nearestPickup(b, false);
        target = pk ? pk.pos : ISLANDS[b.island]!.generator;
      }
    }

    if (target) {
      const dx = target.x - b.pos.x;
      const dz = target.z - b.pos.z;
      const len = Math.hypot(dx, dz);
      if (len > 1.2) {
        let ux = dx / len;
        let uz = dz / len;
        if (!isOnGround(b.pos.x + ux * 1.5, b.pos.z + uz * 1.5)) {
          // desvia em direção ao centro do mapa (as pontes levam ao centro)
          const cl = Math.hypot(b.pos.x, b.pos.z) || 1;
          ux = -b.pos.x / cl;
          uz = -b.pos.z / cl;
        }
        b.moving = true;
        b.yaw = Math.atan2(-ux, -uz);
        this.moveEntity(b, ux, uz, dt);
      } else b.moving = false;
    } else b.moving = false;

    if (shootAt) {
      const dx = shootAt.x - b.pos.x;
      const dz = shootAt.z - b.pos.z;
      const dy = shootAt.y - (b.pos.y + 1.4);
      const d = Math.hypot(dx, dz);
      const yaw = Math.atan2(-dx, -dz);
      b.yaw = yaw;
      const pitch = Math.atan2(dy, d);
      if (d <= WEAPONS[b.weapon].range) this.tryShoot(b, yaw, pitch);
    }
    if (b.ammo <= 0) this.startReload(b);
  }

  private botWants(b: Participant) {
    for (const id of ["sniper", "rifle", "shotgun", "metralhadora"] as WeaponId[]) {
      if (this.canBuyWeapon(b, id)) return true;
    }
    return b.iron > 90;
  }

  private botBuy(b: Participant) {
    for (const id of ["sniper", "rifle", "metralhadora", "shotgun"] as WeaponId[]) {
      if (this.canBuyWeapon(b, id)) {
        this.buyWeapon(b, id);
        return;
      }
    }
    for (const id of ["velocidade", "armadura", "nucleo"] as UpgradeId[]) {
      if (this.buyUpgrade(b, id)) return;
    }
  }

  private nearestEnemy(b: Participant, range: number) {
    let best: Participant | null = null;
    let bd = range;
    for (const p of this.participants) {
      if (p.id === b.id || !p.alive || p.eliminated || p.protectedUntil > this.time) continue;
      const d = dist2D(b.pos, p.pos);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  private nearestEnemyCore(b: Participant, range: number) {
    let best: Participant | null = null;
    let bd = range;
    for (const p of this.participants) {
      if (p.id === b.id || p.coreHp <= 0) continue;
      const d = dist2D(b.pos, ISLANDS[p.island]!.core);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  private nearestPickup(b: Participant, center: boolean) {
    let best: Pickup | null = null;
    let bd = center ? 999 : 45;
    for (const pk of this.pickups) {
      if (center && Math.hypot(pk.pos.x, pk.pos.z) > TUNING.centerRadius + 4) continue;
      if (!center && dist2D(pk.pos, ISLANDS[b.island]!.center) > TUNING.islandRadius + 3) continue;
      const d = dist2D(b.pos, pk.pos);
      if (d < bd) {
        bd = d;
        best = pk;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- fim

  private cleanup() {
    this.tracers = this.tracers.filter((t) => this.time - t.born < 0.09);
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
    return dist2D(p.pos, ISLANDS[p.island]!.shop) < 4.5;
  }
}

declare module "./types" {
  interface Participant {
    aimYaw?: number;
    aimPitch?: number;
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
