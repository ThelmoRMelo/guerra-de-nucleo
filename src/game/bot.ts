// IA dos bots: objetivos, pathfinding, steering, combate e personalidades.
import { TUNING, WEAPONS, type UpgradeId, type WeaponId } from "./config";
import { ISLANDS, dist2D, isOnGround } from "./world";
import {
  ISLAND_NODES,
  OBSTACLES as OBSTACLE_CACHE,
  findPath,
  hasLineOfSight,
  obstacleAt,
} from "./nav";
import type { Participant, Vec3 } from "./types";
import type { GameEngine } from "./engine";

export type BotPersonality = "AGRESSIVO" | "ESTRATEGICO" | "DEFENSIVO" | "EQUILIBRADO";
export type Difficulty = "facil" | "normal" | "dificil";

interface Brain {
  personality: BotPersonality;
  path: Vec3[];
  pathIdx: number;
  goalKey: string;
  targetIsland: number;
  repathAt: number;
  stuckTimer: number;
  stuckCount: number;
  lastX: number;
  lastZ: number;
  detourUntil: number;
  detourSide: number;
  strafeSide: number;
  strafeUntil: number;
  seenEnemyAt: number;
  slot: number;
}

declare module "./types" {
  interface Participant {
    brain?: Brain;
  }
}

const PERSONALITIES: BotPersonality[] = ["AGRESSIVO", "ESTRATEGICO", "DEFENSIVO", "EQUILIBRADO"];

const DIFF = {
  facil: { vision: 24, react: 1.3, aimError: 0.14, decision: 1.1, engage: 16 },
  normal: { vision: 34, react: 0.6, aimError: 0.07, decision: 0.75, engage: 22 },
  dificil: { vision: 46, react: 0.25, aimError: 0.025, decision: 0.45, engage: 28 },
} as const;

export function ensureBrain(b: Participant, index: number): Brain {
  if (!b.brain) {
    b.brain = {
      personality: PERSONALITIES[index % PERSONALITIES.length]!,
      path: [],
      pathIdx: 0,
      goalKey: "",
      targetIsland: -1,
      repathAt: 0,
      stuckTimer: 0,
      stuckCount: 0,
      lastX: b.pos.x,
      lastZ: b.pos.z,
      detourUntil: 0,
      detourSide: 1,
      strafeSide: Math.random() < 0.5 ? 1 : -1,
      strafeUntil: 0,
      seenEnemyAt: -99,
      slot: index,
    };
  }
  return b.brain;
}

/** Reinicia a navegação e atribui imediatamente um novo alvo inimigo após respawn. */
export function resetBotAfterRespawn(engine: GameEngine, b: Participant, time: number) {
  const brain = ensureBrain(b, b.island);
  brain.path = [];
  brain.pathIdx = 0;
  brain.goalKey = "";
  brain.targetIsland = -1;
  brain.repathAt = 0;
  brain.stuckTimer = 0;
  brain.stuckCount = 0;
  brain.lastX = b.pos.x;
  brain.lastZ = b.pos.z;
  brain.detourUntil = 0;
  brain.strafeUntil = 0;
  brain.seenEnemyAt = -99;
  b.botTargetId = null;
  b.moving = false;
  // Evita a rotina de coleta/retorno após morrer: ela era a responsável por
  // deixar bots presos na própria ilha. O bot sai já com um núcleo inimigo alvo.
  const targetIsland = chooseTargetIsland(engine, b);
  brain.targetIsland = targetIsland;
  b.botState = targetIsland >= 0 ? "ATACAR_BASE" : "COLETAR";
  // Mantém o alvo por tempo suficiente para iniciar a rota ofensiva.
  b.botDecisionAt = time + 0.8;
}

// ---------------------------------------------------------------- update

export function updateBot(engine: GameEngine, b: Participant, dt: number) {
  if (!b.alive || b.eliminated) return;
  const brain = ensureBrain(b, b.island);
  const cfg = DIFF[engine.difficulty];
  const isl = ISLANDS[b.island]!;

  const enemy = visibleEnemy(engine, b, cfg.vision);
  if (enemy) brain.seenEnemyAt = engine.time;

  // ---- decisão em intervalos (performance)
  if (engine.time >= b.botDecisionAt) {
    b.botDecisionAt = engine.time + cfg.decision + Math.random() * 0.4;
    decide(engine, b, brain, enemy);
  }

  let moveTarget: Vec3 | null = null;
  let shootAt: Vec3 | null = null;
  let combat = false;

  switch (b.botState) {
    case "FUGIR": {
      const e = enemy ?? nearestEnemyAny(engine, b, 60);
      const away = e
        ? { x: b.pos.x + (b.pos.x - e.pos.x), y: 0, z: b.pos.z + (b.pos.z - e.pos.z) }
        : isl.spawn;
      moveTarget = isOnGround(away.x, away.z) ? away : isl.spawn;
      brain.path = [];
      break;
    }
    case "ATACAR":
    case "PERSEGUIR": {
      const e = engine.participants.find((p) => p.id === b.botTargetId);
      if (e && e.alive && !e.eliminated) {
        combat = true;
        const d = dist2D(b.pos, e.pos);
        const w = WEAPONS[b.weapon];
        const ideal = Math.min(w.range * 0.55, 22);
        const los = hasLineOfSight(b.pos, e.pos);
        if (d < ideal * 0.6)
          moveTarget = { x: b.pos.x * 2 - e.pos.x, y: 0, z: b.pos.z * 2 - e.pos.z };
        else moveTarget = e.pos; // aproxima/orbita — nunca fica parado atirando
        if (los && d <= w.range) shootAt = { x: e.pos.x, y: e.pos.y + 1.1, z: e.pos.z };
      } else b.botState = "REPOSICIONAR";
      break;
    }
    case "DEFENDER":
      moveTarget = pathStep(engine, b, brain, `def${b.island}`, ISLAND_NODES[b.island]!.coreId);
      break;
    case "COMPRAR": {
      moveTarget = pathStep(engine, b, brain, `shop${b.island}`, ISLAND_NODES[b.island]!.shopId);
      if (dist2D(b.pos, isl.shop) < 5) {
        botBuy(engine, b);
        b.botState = "ATACAR_BASE";
        brain.path = [];
      }
      break;
    }
    case "COLETAR": {
      // sem diamantes: o centro do mapa é a única fonte
      const wantCenter = b.diamond < 5;
      const pk = nearestPickup(engine, b, 70, wantCenter);
      if (pk) {
        moveTarget =
          dist2D(b.pos, pk.pos) < 22 && hasLineOfSight(b.pos, pk.pos)
            ? pk.pos
            : pathStepTo(engine, b, brain, pk.pos);
      } else if (wantCenter) {
        moveTarget = pathStep(engine, b, brain, `ring${b.island}`, ISLAND_NODES[b.island]!.ringId);
      } else {
        moveTarget = pathStep(engine, b, brain, `gen${b.island}`, ISLAND_NODES[b.island]!.genId);
      }
      // nada a fazer aqui: volta ao comportamento ofensivo
      if (moveTarget && dist2D(b.pos, moveTarget) < 1.6) {
        brain.path = [];
        brain.goalKey = "";
        const t = chooseTargetIsland(engine, b);
        if (t >= 0) {
          brain.targetIsland = t;
          b.botState = "ATACAR_BASE";
        }
      }
      break;
    }

    case "ATACAR_BASE":
    case "NUCLEO": {
      const t = brain.targetIsland;
      const owner = t >= 0 ? engine.participants.find((p) => p.island === t) : null;
      if (!owner || owner.coreHp <= 0) {
        brain.targetIsland = -1;
        b.botState = "REPOSICIONAR";
        break;
      }
      const core = ISLANDS[t]!.core;
      const d = dist2D(b.pos, core);
      if (d < 18 && hasLineOfSight(b.pos, core, 3)) {
        shootAt = { x: core.x, y: 1.5, z: core.z };
        b.botState = "NUCLEO";
        moveTarget = core;
        combat = d < 12; // circula em volta do núcleo
      } else {
        const nodes = ISLAND_NODES[t]!;

        const nodeId = brain.slot % 2 === 0 ? nodes.coreId : nodes.centerId;
        moveTarget = pathStep(engine, b, brain, `atk${t}${nodeId}`, nodeId);
      }
      break;
    }
    default: {
      // REPOSICIONAR / RETORNAR
      moveTarget = pathStep(engine, b, brain, `home${b.island}`, ISLAND_NODES[b.island]!.centerId);
      if (dist2D(b.pos, isl.center) < 6) b.botState = "COLETAR";
    }
  }

  // ---- movimento com steering
  if (moveTarget) {
    steerTo(engine, b, brain, moveTarget, dt, combat);
  } else {
    b.moving = false;
  }

  // ---- detecção de travamento
  const moved = Math.hypot(b.pos.x - brain.lastX, b.pos.z - brain.lastZ);
  brain.lastX = b.pos.x;
  brain.lastZ = b.pos.z;
  if (b.moving && moved < 0.02) {
    brain.stuckTimer += dt;
    if (brain.stuckTimer > 0.8) {
      brain.stuckTimer = 0;
      brain.path = [];
      brain.goalKey = "";
      brain.repathAt = 0;
      brain.detourSide = Math.random() < 0.5 ? 1 : -1;
      brain.detourUntil = engine.time + 0.7 + Math.random() * 0.5;
      brain.stuckCount += 1;
      if (brain.stuckCount >= 2) {
        // objetivo impossível: escolhe outro
        brain.stuckCount = 0;
        brain.targetIsland = -1;
        b.botState = "REPOSICIONAR";
        b.botDecisionAt = engine.time + 0.3;
      }
    }
  } else if (moved > 0.03) {
    brain.stuckTimer = 0;
    brain.stuckCount = 0;
  }

  // ---- disparo (com erro de mira por dificuldade, sem atravessar paredes)
  if (shootAt && engine.time - brain.seenEnemyAt >= 0 && b.hp > 0) {
    const dx = shootAt.x - b.pos.x;
    const dz = shootAt.z - b.pos.z;
    const dy = shootAt.y - (b.pos.y + 1.4);
    const d = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, -dz) + (Math.random() - 0.5) * cfg.aimError;
    b.yaw = yaw;
    if (d <= WEAPONS[b.weapon].range) engine.tryShoot(b, yaw, Math.atan2(dy, d));
  }
}

// ---------------------------------------------------------------- decisão

function decide(engine: GameEngine, b: Participant, brain: Brain, enemy: Participant | null) {
  const cfg = DIFF[engine.difficulty];
  const isl = ISLANDS[b.island]!;
  const pers = brain.personality;
  const fleeHp = pers === "AGRESSIVO" ? 20 : pers === "DEFENSIVO" ? 40 : 30;

  if (b.hp < fleeHp && enemy) {
    b.botState = "FUGIR";
    return;
  }

  // defesa da própria base
  const invader = engine.participants.find(
    (p) =>
      p.id !== b.id &&
      p.alive &&
      !p.eliminated &&
      dist2D(p.pos, isl.core) < TUNING.islandRadius + 4,
  );
  if (invader && (pers === "DEFENSIVO" || b.coreHp < TUNING.coreMaxHp * 0.7)) {
    b.botState = "ATACAR";
    b.botTargetId = invader.id;
    return;
  }

  // inimigo próximo o suficiente para valer o combate
  if (enemy) {
    const d = dist2D(b.pos, enemy.pos);
    const engageRange = pers === "AGRESSIVO" ? cfg.engage * 1.4 : cfg.engage;
    const advantage = b.hp >= enemy.hp * 0.7 || d < 10;
    if (d < engageRange && advantage) {
      b.botState = "ATACAR";
      b.botTargetId = enemy.id;
      return;
    }
  }

  // economia: precisa de equipamento?
  const onlyPistol = b.owned.length <= 1;
  if (canBuySomething(engine, b) && (onlyPistol || pers === "ESTRATEGICO" || Math.random() < 0.4)) {
    b.botState = "COMPRAR";
    return;
  }
  // Um cristal é suficiente: depois disso o bot deixa a ilha e ataca com a pistola.
  // Ele só volta à loja quando já tiver diamantes para melhorar o equipamento.
  const needsResources = onlyPistol && b.diamond < 5;
  if (needsResources || (pers !== "AGRESSIVO" && b.diamond < 5 && Math.random() < 0.15)) {
    b.botState = "COLETAR";
    return;
  }

  // ofensiva: escolher base alvo
  const target = chooseTargetIsland(engine, b);
  if (target >= 0) {
    brain.targetIsland = target;
    if (b.botState !== "NUCLEO") b.botState = "ATACAR_BASE";
    return;
  }
  b.botState = "COLETAR";
}

function chooseTargetIsland(engine: GameEngine, b: Participant) {
  let best = -1;
  let bestScore = -Infinity;
  for (const p of engine.participants) {
    // Participantes humanos e bots são alvos válidos; somente o próprio núcleo é ignorado.
    if (p.id === b.id || p.island === b.island || p.coreHp <= 0) continue;
    const core = ISLANDS[p.island]!.core;
    const route = dist2D(b.pos, { x: 0, y: 0, z: 0 }) + dist2D({ x: 0, y: 0, z: 0 }, core);
    const defenders = engine.participants.filter(
      (o) => o.id !== b.id && o.alive && !o.eliminated && dist2D(o.pos, core) < 16,
    ).length;
    const damaged = (TUNING.coreMaxHp - p.coreHp) * 0.8;
    const humanTargetBonus = p.isBot ? 0 : 35;
    const score = 200 - route * 0.9 - defenders * 18 + damaged + humanTargetBonus;
    if (score > bestScore) {
      bestScore = score;
      best = p.island;
    }
  }
  return best;
}

// ---------------------------------------------------------------- rota

function pathStep(
  engine: GameEngine,
  b: Participant,
  brain: Brain,
  key: string,
  nodeId: number,
): Vec3 {
  if (brain.goalKey !== key || brain.path.length === 0 || engine.time >= brain.repathAt) {
    brain.goalKey = key;
    brain.path = findPath(b.pos, nodeId);
    brain.pathIdx = 0;
    brain.repathAt = engine.time + 4 + Math.random();
  }
  return followPath(b, brain);
}

function pathStepTo(engine: GameEngine, b: Participant, brain: Brain, pos: Vec3): Vec3 {
  // alvo livre (recurso): usa o waypoint da ilha mais próxima do alvo
  let bestIsland = 0;
  let bd = Infinity;
  for (const isl of ISLANDS) {
    const d = dist2D(isl.center, pos);
    if (d < bd) {
      bd = d;
      bestIsland = isl.index;
    }
  }
  const nodeId =
    Math.hypot(pos.x, pos.z) < TUNING.centerRadius
      ? ISLAND_NODES[b.island]!.ringId
      : ISLAND_NODES[bestIsland]!.centerId;
  const wp = pathStep(engine, b, brain, `pk${nodeId}`, nodeId);
  // trecho final: já chegou ao waypoint, segue direto até o recurso
  if (dist2D(b.pos, wp) < 2.5 && dist2D(b.pos, pos) < 20) return pos;
  return dist2D(b.pos, pos) < 14 && hasLineOfSight(b.pos, pos) ? pos : wp;
}

function followPath(b: Participant, brain: Brain): Vec3 {
  while (brain.pathIdx < brain.path.length - 1) {
    const wp = brain.path[brain.pathIdx]!;
    if (dist2D(b.pos, wp) < 3) brain.pathIdx += 1;
    else break;
  }
  const wp = brain.path[brain.pathIdx];
  if (!wp) return b.pos;
  if (brain.pathIdx === brain.path.length - 1 && dist2D(b.pos, wp) < 2.6) return b.pos;
  return wp;
}

// ---------------------------------------------------------------- steering

function steerTo(
  engine: GameEngine,
  b: Participant,
  brain: Brain,
  target: Vec3,
  dt: number,
  combat: boolean,
) {
  const dx = target.x - b.pos.x;
  const dz = target.z - b.pos.z;
  let len = Math.hypot(dx, dz);
  if (len < 0.8 && !combat) {
    b.moving = false;
    return;
  }
  let ux = len > 0.001 ? dx / len : Math.sin(b.yaw);
  let uz = len > 0.001 ? dz / len : Math.cos(b.yaw);

  // combate: strafe lateral em vez de ficar parado
  if (combat) {
    if (engine.time >= brain.strafeUntil) {
      brain.strafeUntil = engine.time + 0.8 + Math.random() * 1.2;
      brain.strafeSide = Math.random() < 0.5 ? 1 : -1;
    }
    const px = -uz * brain.strafeSide;
    const pz = ux * brain.strafeSide;
    ux += px * 0.9;
    uz += pz * 0.9;
  }

  // desvio de obstáculos (repulsão + contorno tangencial) — relaxa perto do alvo
  const closeToTarget = len < 3.2;
  if (!closeToTarget) {
    for (const o of nearObstacles(b.pos)) {
      const ox = b.pos.x - o.x;
      const oz = b.pos.z - o.z;
      const d = Math.hypot(ox, oz) || 0.001;
      const influence = o.r + 2.2;
      if (d < influence) {
        const w = (influence - d) / influence;
        ux += (ox / d) * w * 2.2;
        uz += (oz / d) * w * 2.2;
        ux += (-oz / d) * w * brain.detourSide * 1.2;
        uz += (ox / d) * w * brain.detourSide * 1.2;
      }
    }
  }

  // separação de outros personagens
  for (const o of engine.participants) {
    if (o.id === b.id || !o.alive || o.eliminated) continue;
    const ox = b.pos.x - o.pos.x;
    const oz = b.pos.z - o.pos.z;
    const d = Math.hypot(ox, oz);
    if (d < 2.6 && d > 0.001) {
      const w = (2.6 - d) / 2.6;
      ux += (ox / d) * w * 1.8;
      uz += (oz / d) * w * 1.8;
    }
  }

  // desvio forçado após ficar preso
  if (engine.time < brain.detourUntil) {
    const px = -uz;
    const pz = ux;
    ux += px * brain.detourSide * 1.6;
    uz += pz * brain.detourSide * 1.6;
  }

  len = Math.hypot(ux, uz) || 1;
  ux /= len;
  uz /= len;

  // sonda de chão/obstáculo: procura a direção livre mais próxima da desejada
  const dir = freeDirection(b.pos, ux, uz, closeToTarget ? 0.05 : 0.5);
  if (!dir) {
    b.moving = false;
    return;
  }
  b.moving = true;
  b.yaw = Math.atan2(-dir.x, -dir.z);
  engine.moveEntity(b, dir.x, dir.z, dt);
}

const PROBE_ANGLES = [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, 2.2, -2.2, Math.PI];

function freeDirection(
  pos: Vec3,
  ux: number,
  uz: number,
  margin: number,
): { x: number; z: number } | null {
  for (const a of PROBE_ANGLES) {
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const dx = ux * cos - uz * sin;
    const dz = ux * sin + uz * cos;
    const nearX = pos.x + dx * 1.4;
    const nearZ = pos.z + dz * 1.4;
    const farX = pos.x + dx * 2.8;
    const farZ = pos.z + dz * 2.8;
    if (!isOnGround(nearX, nearZ) || !isOnGround(farX, farZ)) continue;
    if (obstacleAt(nearX, nearZ, margin)) continue;
    return { x: dx, z: dz };
  }
  return null;
}

function nearObstacles(pos: Vec3) {
  const out = [] as { x: number; z: number; r: number }[];
  for (const o of OBSTACLE_CACHE) {
    if (Math.abs(o.x - pos.x) < 8 && Math.abs(o.z - pos.z) < 8) out.push(o);
  }
  return out;
}

// ---------------------------------------------------------------- percepção

function visibleEnemy(engine: GameEngine, b: Participant, vision: number) {
  let best: Participant | null = null;
  let bd = vision;
  for (const p of engine.participants) {
    if (p.id === b.id || !p.alive || p.eliminated || p.protectedUntil > engine.time) continue;
    const d = dist2D(b.pos, p.pos);
    if (d < bd && hasLineOfSight(b.pos, p.pos)) {
      bd = d;
      best = p;
    }
  }
  return best;
}

function nearestEnemyAny(engine: GameEngine, b: Participant, range: number) {
  let best: Participant | null = null;
  let bd = range;
  for (const p of engine.participants) {
    if (p.id === b.id || !p.alive || p.eliminated) continue;
    const d = dist2D(b.pos, p.pos);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

function nearestPickup(engine: GameEngine, b: Participant, range: number, preferCenter = false) {
  let best = null as (typeof engine.pickups)[number] | null;
  let bd = preferCenter ? 999 : range;
  for (const pk of engine.pickups) {
    if (preferCenter && pk.type !== "diamond") continue;
    const d = dist2D(b.pos, pk.pos);
    if (d < bd) {
      bd = d;
      best = pk;
    }
  }
  return best;
}

// ---------------------------------------------------------------- economia

const WEAPON_ORDER: WeaponId[] = ["sniper", "rifle", "metralhadora", "shotgun"];

function canBuySomething(engine: GameEngine, b: Participant) {
  for (const id of WEAPON_ORDER) if (engine.canBuyWeapon(b, id)) return true;
  return b.diamond >= 20;
}

function botBuy(engine: GameEngine, b: Participant) {
  const brain = ensureBrain(b, b.island);
  const prefer: WeaponId[] =
    brain.personality === "AGRESSIVO"
      ? ["rifle", "metralhadora", "shotgun", "sniper"]
      : brain.personality === "DEFENSIVO"
        ? ["sniper", "rifle", "shotgun", "metralhadora"]
        : WEAPON_ORDER;
  for (const id of prefer) {
    if (engine.canBuyWeapon(b, id)) {
      engine.buyWeapon(b, id);
      break;
    }
  }
  const ups: UpgradeId[] =
    brain.personality === "AGRESSIVO"
      ? ["velocidade", "nucleo", "armadura"]
      : brain.personality === "DEFENSIVO"
        ? ["armadura", "regeneracao", "velocidade"]
        : ["nucleo", "armadura", "velocidade"];
  for (const id of ups) if (engine.buyUpgrade(b, id)) break;
}
