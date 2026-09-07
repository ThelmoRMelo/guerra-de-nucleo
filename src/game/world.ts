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
