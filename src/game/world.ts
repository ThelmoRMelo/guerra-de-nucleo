import { TUNING } from "./config";
import type { Vec3 } from "./types";

export interface IslandLayout {
  index: number;
  center: Vec3;
  angle: number;
  core: Vec3;
  shop: Vec3;
  generator: Vec3;
  spawn: Vec3;
}

export const ISLANDS: IslandLayout[] = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  const cx = Math.cos(angle) * TUNING.islandDistance;
  const cz = Math.sin(angle) * TUNING.islandDistance;
  // vetor apontando para o centro do mapa
  const ix = -Math.cos(angle);
  const iz = -Math.sin(angle);
  return {
    index: i,
    angle,
    center: { x: cx, y: 0, z: cz },
    core: { x: cx - ix * 4.5, y: 0, z: cz - iz * 4.5 },
    shop: { x: cx + iz * 6, y: 0, z: cz - ix * 6 },
    generator: { x: cx - iz * 6, y: 0, z: cz + ix * 6 },
    spawn: { x: cx - ix * 7.5, y: 0, z: cz - iz * 7.5 },
  };
});

export const CENTER_GEN: Vec3 = { x: 0, y: 0, z: 0 };

export const PIRATE_SHIP = {
  halfWidth: 35,
  halfDepth: 21,
  wallHeight: 4.8,
  wallThickness: 1.2,
  portalHeight: 4.8,
  portalClearance: 1.5,
} as const;

export type PirateWallSide = "north" | "south" | "east" | "west";

export interface PiratePortal {
  index: number;
  angle: number;
  side: PirateWallSide;
  x: number;
  z: number;
  openingWidth: number;
  wallRotation: number;
}

/**
 * Interseções exatas das oito linhas radiais das pontes com a muralha do navio.
 * A largura considera a projeção da ponte sobre a parede e uma pequena folga.
 */
export const PIRATE_PORTALS: PiratePortal[] = ISLANDS.map((island) => {
  const cos = Math.cos(island.angle);
  const sin = Math.sin(island.angle);
  const horizontalDistance = Math.abs(cos) > 0.0001 ? PIRATE_SHIP.halfWidth / Math.abs(cos) : Infinity;
  const verticalDistance = Math.abs(sin) > 0.0001 ? PIRATE_SHIP.halfDepth / Math.abs(sin) : Infinity;

  if (verticalDistance <= horizontalDistance) {
    return {
      index: island.index,
      angle: island.angle,
      side: sin < 0 ? "north" : "south",
      x: cos * verticalDistance,
      z: sin < 0 ? -PIRATE_SHIP.halfDepth : PIRATE_SHIP.halfDepth,
      openingWidth: TUNING.bridgeWidth / Math.abs(sin) + PIRATE_SHIP.portalClearance,
      wallRotation: 0,
    };
  }

  return {
    index: island.index,
    angle: island.angle,
    side: cos < 0 ? "west" : "east",
    x: cos < 0 ? -PIRATE_SHIP.halfWidth : PIRATE_SHIP.halfWidth,
    z: sin * horizontalDistance,
    openingWidth: TUNING.bridgeWidth / Math.abs(cos) + PIRATE_SHIP.portalClearance,
    wallRotation: Math.PI / 2,
  };
});

export interface PirateWallSegment {
  side: PirateWallSide;
  x: number;
  z: number;
  length: number;
  rotation: number;
}

function buildWallSegments(side: PirateWallSide): PirateWallSegment[] {
  const horizontal = side === "north" || side === "south";
  const halfLength = horizontal ? PIRATE_SHIP.halfWidth : PIRATE_SHIP.halfDepth;
  const portals = PIRATE_PORTALS
    .filter((portal) => portal.side === side)
    .map((portal) => ({
      center: horizontal ? portal.x : portal.z,
      halfOpening: portal.openingWidth / 2,
    }))
    .sort((a, b) => a.center - b.center);
  const segments: PirateWallSegment[] = [];
  let cursor = -halfLength;

  for (const portal of portals) {
    const end = Math.max(cursor, portal.center - portal.halfOpening);
    if (end > cursor) {
      const center = (cursor + end) / 2;
      segments.push({
        side,
        x: horizontal ? center : side === "west" ? -PIRATE_SHIP.halfWidth : PIRATE_SHIP.halfWidth,
        z: horizontal ? (side === "north" ? -PIRATE_SHIP.halfDepth : PIRATE_SHIP.halfDepth) : center,
        length: end - cursor,
        rotation: horizontal ? 0 : Math.PI / 2,
      });
    }
    cursor = Math.min(halfLength, portal.center + portal.halfOpening);
  }

  if (cursor < halfLength) {
    const center = (cursor + halfLength) / 2;
    segments.push({
      side,
      x: horizontal ? center : side === "west" ? -PIRATE_SHIP.halfWidth : PIRATE_SHIP.halfWidth,
      z: horizontal ? (side === "north" ? -PIRATE_SHIP.halfDepth : PIRATE_SHIP.halfDepth) : center,
      length: halfLength - cursor,
      rotation: horizontal ? 0 : Math.PI / 2,
    });
  }

  return segments;
}

/** Trechos sólidos da muralha; os intervalos ausentes são exatamente os oito portais. */
export const PIRATE_WALL_SEGMENTS: PirateWallSegment[] = (
  ["north", "south", "east", "west"] as PirateWallSide[]
).flatMap(buildWallSegments);

/**
 * Colisores da Ilha Pirata.
 *
 * Cada trecho visual sólido recebe uma sequência contínua de círculos.
 * Como visual e colisão usam PIRATE_WALL_SEGMENTS, não existem paredes
 * invisíveis nos portais nem brechas atravessáveis nas partes fechadas.
 */
const pirateWallObstacles = [
  ...PIRATE_WALL_SEGMENTS.flatMap((segment) => {
    const radius = PIRATE_SHIP.wallThickness / 2;
    const count = Math.max(1, Math.ceil(segment.length / (radius * 2)));
    return Array.from({ length: count }, (_, index) => {
      const offset = -segment.length / 2 + ((index + 0.5) * segment.length) / count;
      return {
        x: segment.rotation === 0 ? segment.x + offset : segment.x,
        z: segment.rotation === 0 ? segment.z : segment.z + offset,
        r: radius,
      };
    });
  }),

  // ============================
  // CAVEIRAS / OBSTÁCULOS INTERNOS
  // ============================

  ...Array.from({ length: 10 }, (_, i) => {
    const a = i * 1.91;
    const r = 19 + (i % 2) * 7;

    return {
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      r: i % 3 === 0 ? 1.35 : 1.0,
    };
  }),

  ...Array.from({ length: 6 }, (_, i) => {
    const a = i * 1.91;
    const r = (19 + (i % 2) * 7) * 0.8;

    return {
      x: Math.cos(a) * r,
      z: Math.sin(a) * r,
      r: 1.35,
    };
  }),
];

/** Colisores do navio oco, rochas e caveiras da arena Ilha Pirata. */
export const PIRATE_OBSTACLES = pirateWallObstacles;



/** Retorna true se a posição horizontal está sobre chão sólido (ilha, centro ou ponte). */
export function isOnGround(x: number, z: number): boolean {
  const dc = Math.hypot(x, z);
  if (dc <= TUNING.centerRadius) return true;
  for (const isl of ISLANDS) {
    if (Math.hypot(x - isl.center.x, z - isl.center.z) <= TUNING.islandRadius) return true;
    // ponte: projeção no segmento centro-do-mapa -> ilha
    const len = TUNING.islandDistance;
    const ux = isl.center.x / len;
    const uz = isl.center.z / len;
    const t = x * ux + z * uz;
    if (t > 0 && t < len) {
      const perp = Math.abs(-uz * x + ux * z);
      if (perp <= TUNING.bridgeWidth / 2) return true;
    }
  }
  return false;
}

export function randomPointOnIsland(i: number, radius = TUNING.islandRadius - 2.5): Vec3 {
  const isl = ISLANDS[i]!;
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return { x: isl.center.x + Math.cos(a) * r, y: 0, z: isl.center.z + Math.sin(a) * r };
}

export function dist2D(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
