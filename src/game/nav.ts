// Navegação: obstáculos, grafo de waypoints, A* e linha de visão.
import { TUNING } from "./config";
import { ISLANDS } from "./world";
import type { Vec3 } from "./types";

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

/** Obstáculos sólidos aproximados por círculos (mesmos props renderizados em World3D). */
export const OBSTACLES: Obstacle[] = (() => {
  const list: Obstacle[] = [];
  // gerador central
  list.push({ x: 0, z: 0, r: 2.6 });
  // pedras decorativas da ilha central
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    list.push({
      x: Math.cos(a) * (TUNING.centerRadius - 4),
      z: Math.sin(a) * (TUNING.centerRadius - 4),
      r: 1.2,
    });
  }
  for (const isl of ISLANDS) {
    list.push({ x: isl.shop.x, z: isl.shop.z, r: 2.0 });
    list.push({ x: isl.generator.x, z: isl.generator.z, r: 1.6 });
    // base do núcleo (contornável, mas o núcleo continua atacável)
    list.push({ x: isl.core.x, z: isl.core.z, r: 2.0 });
    for (let i = 0; i < 3; i++) {
      const a = isl.angle + Math.PI / 2 + (i - 1) * 0.55;
      const r = TUNING.islandRadius - 2.2;
      list.push({ x: isl.center.x + Math.cos(a) * r, z: isl.center.z + Math.sin(a) * r, r: 1.1 });
    }
  }
  return list;
})();

export function obstacleAt(x: number, z: number, margin = 0): Obstacle | null {
  for (const o of OBSTACLES) {
    const d = Math.hypot(x - o.x, z - o.z);
    if (d < o.r + margin) return o;
  }
  return null;
}

/** Linha de visão horizontal: falso quando um obstáculo bloqueia o disparo. */
export function hasLineOfSight(from: Vec3, to: Vec3, ignoreRadiusAtTarget = 2.2): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.001) return true;
  const ux = dx / len;
  const uz = dz / len;
  for (const o of OBSTACLES) {
    // projeção do centro do obstáculo no segmento
    const t = (o.x - from.x) * ux + (o.z - from.z) * uz;
    if (t <= 0.2 || t >= len - 0.2) continue;
    if (len - t < ignoreRadiusAtTarget) continue; // obstáculo colado no alvo (ex.: base do núcleo)
    const px = from.x + ux * t;
    const pz = from.z + uz * t;
    if (Math.hypot(px - o.x, pz - o.z) < o.r * 0.9) return false;
  }
  return true;
}

// ---------------------------------------------------------------- grafo

export interface NavNode {
  id: number;
  pos: Vec3;
  links: number[];
}

export const NAV_NODES: NavNode[] = [];

function addNode(x: number, z: number): NavNode {
  const n: NavNode = { id: NAV_NODES.length, pos: { x, y: 0, z }, links: [] };
  NAV_NODES.push(n);
  return n;
}

function link(a: NavNode, b: NavNode) {
  if (!a.links.includes(b.id)) a.links.push(b.id);
  if (!b.links.includes(a.id)) b.links.push(a.id);
}

/** Nós-chave por ilha, para consulta rápida das rotas. */
export const ISLAND_NODES: {
  ringId: number;
  bridgeInId: number;
  bridgeOutId: number;
  centerId: number;
  coreId: number;
  shopId: number;
  genId: number;
}[] = [];

(() => {
  const ring: NavNode[] = [];
  const bridges: NavNode[] = [];
  for (const isl of ISLANDS) {
    const c = Math.cos(isl.angle);
    const s = Math.sin(isl.angle);
    // anel interno da ilha central (contorna o gerador do centro)
    const ringR = TUNING.centerRadius - 7;
    ring.push(addNode(c * ringR, s * ringR));
    // entrada da ponte (borda do centro) e saída (borda da ilha)
    bridges.push(addNode(c * (TUNING.centerRadius - 1), s * (TUNING.centerRadius - 1)));
  }
  for (let i = 0; i < ISLANDS.length; i++) {
    const isl = ISLANDS[i]!;
    const c = Math.cos(isl.angle);
    const s = Math.sin(isl.angle);
    const bIn = bridges[i]!;
    const bMid = addNode(
      (c * (TUNING.centerRadius + TUNING.islandDistance - TUNING.islandRadius)) / 2,
      (s * (TUNING.centerRadius + TUNING.islandDistance - TUNING.islandRadius)) / 2,
    );
    const bOut = addNode(
      c * (TUNING.islandDistance - TUNING.islandRadius + 1),
      s * (TUNING.islandDistance - TUNING.islandRadius + 1),
    );
    const center = addNode(isl.center.x, isl.center.z);
    // pontos de aproximação em volta do núcleo (ataque de ângulos diferentes)
    const core = addNode(
      isl.core.x + Math.cos(isl.angle + Math.PI / 2) * 3.4,
      isl.core.z + Math.sin(isl.angle + Math.PI / 2) * 3.4,
    );
    const core2 = addNode(
      isl.core.x + Math.cos(isl.angle - Math.PI / 2) * 3.4,
      isl.core.z + Math.sin(isl.angle - Math.PI / 2) * 3.4,
    );
    const shop = addNode(
      isl.shop.x + (isl.center.x - isl.shop.x) * 0.62,
      isl.shop.z + (isl.center.z - isl.shop.z) * 0.62,
    );
    const gen = addNode(
      isl.generator.x + (isl.center.x - isl.generator.x) * 0.62,
      isl.generator.z + (isl.center.z - isl.generator.z) * 0.62,
    );
    link(ring[i]!, bIn);
    link(bIn, bMid);
    link(bMid, bOut);
    link(bOut, center);
    link(center, core);
    link(center, core2);
    link(core, core2);
    link(center, shop);
    link(center, gen);
    ISLAND_NODES.push({
      ringId: ring[i]!.id,
      bridgeInId: bIn.id,
      bridgeOutId: bOut.id,
      centerId: center.id,
      coreId: core.id,
      shopId: shop.id,
      genId: gen.id,
    });
  }
  // anel do centro + travessia interna
  for (let i = 0; i < ring.length; i++) {
    link(ring[i]!, ring[(i + 1) % ring.length]!);
    link(ring[i]!, ring[(i + 2) % ring.length]!);
  }
})();

function nodeDist(a: NavNode, b: NavNode) {
  return Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
}

export function nearestNode(pos: Vec3): NavNode {
  let best = NAV_NODES[0]!;
  let bd = Infinity;
  for (const n of NAV_NODES) {
    const d = Math.hypot(n.pos.x - pos.x, n.pos.z - pos.z);
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best;
}

/** A* no grafo de waypoints. Devolve a lista de posições a percorrer. */
export function findPath(from: Vec3, toNodeId: number): Vec3[] {
  const start = nearestNode(from);
  const goal = NAV_NODES[toNodeId];
  if (!goal) return [];
  if (start.id === goal.id) return [goal.pos];

  const open = new Set<number>([start.id]);
  const cameFrom = new Map<number, number>();
  const g = new Map<number, number>([[start.id, 0]]);
  const f = new Map<number, number>([[start.id, nodeDist(start, goal)]]);

  while (open.size) {
    let current = -1;
    let bestF = Infinity;
    for (const id of open) {
      const v = f.get(id) ?? Infinity;
      if (v < bestF) {
        bestF = v;
        current = id;
      }
    }
    if (current === goal.id) break;
    open.delete(current);
    const node = NAV_NODES[current]!;
    for (const nid of node.links) {
      const nb = NAV_NODES[nid]!;
      const tentative = (g.get(current) ?? Infinity) + nodeDist(node, nb);
      if (tentative < (g.get(nid) ?? Infinity)) {
        cameFrom.set(nid, current);
        g.set(nid, tentative);
        f.set(nid, tentative + nodeDist(nb, goal));
        open.add(nid);
      }
    }
  }

  if (!cameFrom.has(goal.id) && start.id !== goal.id) return [goal.pos];
  const path: Vec3[] = [goal.pos];
  let cur = goal.id;
  while (cameFrom.has(cur)) {
    cur = cameFrom.get(cur)!;
    path.unshift(NAV_NODES[cur]!.pos);
  }
  return path;
}
