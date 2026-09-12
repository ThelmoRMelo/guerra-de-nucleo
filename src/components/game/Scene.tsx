import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { Character } from "./Character";
import { World3D } from "./World3D";
import { TUNING } from "@/game/config";
import { ISLANDS } from "@/game/world";
import { input } from "@/game/input";
import { useGame } from "@/game/store";
import type { GameEngine } from "@/game/engine";
import type { Pickup } from "@/game/types";

const MAX_TRACERS = 16;

export function Scene({ engine }: { engine: GameEngine }) {
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const coreRefs = useRef<(THREE.Group | null)[]>([]);
  const tracerRefs = useRef<(THREE.Mesh | null)[]>([]);
  const pickupGroup = useRef<THREE.Group>(null);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [, forceLabels] = useState(0);
  const setHud = useGame((s) => s.setHud);
  const shopOpen = useGame((s) => s.shopOpen);
  const setShopOpen = useGame((s) => s.setShopOpen);
  const paused = useGame((s) => s.paused);
  const { camera } = useThree();
  const hudTimer = useRef(0);
  const pickTimer = useRef(0);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const lookAt = useMemo(() => new THREE.Vector3(), []);
  const aimPoint = useMemo(() => new THREE.Vector3(), []);
  const aimDirection = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    input.yaw = engine.player.yaw;
  }, [engine]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const blocked = shopOpen || paused || engine.status !== "running";
    const aimPlayer = engine.player;
    camPos.set(
      aimPlayer.pos.x + Math.sin(input.yaw) * 7.5,
      aimPlayer.pos.y + 3.4 - input.pitch * 4,
      aimPlayer.pos.z + Math.cos(input.yaw) * 7.5,
    );
    lookAt.set(
      aimPlayer.pos.x - Math.sin(input.yaw) * 6,
      aimPlayer.pos.y + 1.6 + input.pitch * 7,
      aimPlayer.pos.z - Math.cos(input.yaw) * 6,
    );
    aimDirection.subVectors(lookAt, camPos).normalize();
    aimPoint.copy(camPos).addScaledVector(aimDirection, 160);
    const aimDx = aimPoint.x - aimPlayer.pos.x;
    const aimDz = aimPoint.z - aimPlayer.pos.z;
    const aimDistance = Math.hypot(aimDx, aimDz);
    const aimYaw = Math.atan2(-aimDx, -aimDz);
    const aimPitch = Math.atan2(aimPoint.y - (aimPlayer.pos.y + 1.4), aimDistance);

    if (!blocked) {
      const reload = input.reloadPulse;
      input.reloadPulse = false;
      engine.step(dt, {
        moveX: input.moveX,
        moveZ: input.moveZ,
        yaw: input.yaw,
        pitch: input.pitch,
        aimYaw,
        aimPitch,
        shooting: input.shooting,
        reload,
      });
    } else {
      engine.step(0, {
        moveX: 0,
        moveZ: 0,
        yaw: input.yaw,
        pitch: input.pitch,
        aimYaw,
        aimPitch,
        shooting: false,
        reload: false,
      });
    }

    // interação com o comerciante
    if (input.interactPulse) {
      input.interactPulse = false;
      if (engine.nearShop(engine.player) && engine.player.alive) setShopOpen(!shopOpen);
    }
    if (input.emotePulse) {
      input.emotePulse = false;
      if (engine.player.alive) useGame.getState().setEmoteOpen(true);
    }

    // personagens
    engine.participants.forEach((p, i) => {
      const g = groupRefs.current[i];
      if (!g) return;
      g.visible = p.alive && !p.eliminated;
      g.position.set(p.pos.x, p.pos.y, p.pos.z);
      g.rotation.y = p.yaw;
      const swing = p.moving ? Math.sin(p.walkPhase) * 0.6 : 0;
      const legL = g.getObjectByName("legL");
      const legR = g.getObjectByName("legR");
      const armR = g.getObjectByName("armR");
      if (legL) legL.rotation.x = swing;
      if (legR) legR.rotation.x = -swing;
      if (armR) armR.rotation.x = -swing * 0.6;
      const body = g.getObjectByName("body");
      if (body) body.position.y = p.moving ? Math.abs(Math.sin(p.walkPhase)) * 0.06 : 0;
    });

    // núcleos
    engine.participants.forEach((p, i) => {
      const c = coreRefs.current[i];
      if (!c) return;
      c.visible = p.coreHp > 0;
      c.rotation.y += dt * 0.8;
      c.position.y = 1.5 + Math.sin(engine.time * 1.6 + i) * 0.12;
    });

    // tracers
    for (let i = 0; i < MAX_TRACERS; i++) {
      const m = tracerRefs.current[i];
      if (!m) continue;
      const t = engine.tracers[i];
      if (!t) {
        m.visible = false;
        continue;
      }
      const from = new THREE.Vector3(t.from.x, t.from.y, t.from.z);
      const to = new THREE.Vector3(t.to.x, t.to.y, t.to.z);
      const len = from.distanceTo(to);
      m.visible = true;
      m.position.copy(from).lerp(to, 0.5);
      m.scale.set(1, 1, Math.max(0.2, len));
      m.lookAt(to);
      (m.material as THREE.MeshBasicMaterial).color.set(t.color);
    }

    // pickups (atualiza a lista em baixa frequência)
    pickTimer.current -= dt;
    if (pickTimer.current <= 0) {
      pickTimer.current = 0.15;
      setPickups([...engine.pickups]);
    }
    if (pickupGroup.current) {
      pickupGroup.current.children.forEach((child, i) => {
        child.rotation.y = engine.time * 1.5 + i;
        child.position.y = 0.7 + Math.sin(engine.time * 2 + i) * 0.12;
      });
    }

    // câmera terceira pessoa
    const pl = engine.player;
    const dist = 7.5;
    const height = 3.4 - input.pitch * 4;
    camPos.set(
      pl.pos.x + Math.sin(input.yaw) * dist,
      pl.pos.y + height,
      pl.pos.z + Math.cos(input.yaw) * dist,
    );
    camera.position.lerp(camPos, 1 - Math.exp(-14 * dt));
    lookAt.set(
      pl.pos.x - Math.sin(input.yaw) * 6,
      pl.pos.y + 1.6 + input.pitch * 7,
      pl.pos.z - Math.cos(input.yaw) * 6,
    );
    camera.lookAt(lookAt);

    // HUD
    hudTimer.current -= dt;
    if (hudTimer.current <= 0) {
      hudTimer.current = 0.1;
      setHud({
        hp: Math.round(pl.hp),
        coreHp: Math.round(pl.coreHp),
        diamond: pl.diamond,
        weapon: pl.weapon,
        owned: [...pl.owned],
        upgrades: { ...pl.upgrades },
        ammo: pl.ammo,
        magazine: engine.magazineOf(pl),
        reloading: engine.time < pl.reloadUntil,
        alive: pl.alive,
        eliminated: pl.eliminated,
        protectedNow: pl.protectedUntil > engine.time,
        respawnIn: Math.max(0, Math.ceil(pl.respawnAt - engine.time)),
        nearShop: engine.nearShop(pl) && pl.alive,
        events: engine.events.map((e) => e.text),
        scoreboard: engine.participants.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          coreHp: Math.round(p.coreHp),
          eliminated: p.eliminated,
          isBot: p.isBot,
          kills: p.kills,
        })),
        status: engine.status,
      });
      forceLabels((n) => n + 1);
    }
  });

  return (
    <>
      <World3D />

      {engine.participants.map((p, i) => (
        <group key={p.id}>
          <Character
            color={p.color}
            ref={(el) => {
              groupRefs.current[i] = el;
            }}
          />
        </group>
      ))}

      {/* etiquetas de nome */}
      {engine.participants.map((p) =>
        p.alive && !p.eliminated && p.id !== engine.playerId ? (
          <Html
            key={`n${p.id}`}
            position={[p.pos.x, p.pos.y + 2.35, p.pos.z]}
            center
            distanceFactor={9}
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div className="whitespace-nowrap rounded-md bg-black/55 px-2 py-0.5 text-[13px] font-bold text-white">
              <span style={{ color: p.color }}>● {p.name}</span>{" "}
              <span className="opacity-80">{Math.round(p.hp)}</span>
            </div>
          </Html>
        ) : null,
      )}

      {/* Emojis visíveis para todos os participantes durante quatro segundos. */}
      {engine.participants.map((p) =>
        p.alive && p.emote && p.emoteUntil > engine.time ? (
          <Html
            key={`e${p.id}`}
            position={[p.pos.x, p.pos.y + 3.35, p.pos.z]}
            center
            distanceFactor={12}
            zIndexRange={[11, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div className="animate-bounce rounded-full bg-white/90 px-2 py-1 text-2xl shadow-lg">
              {p.emote}
            </div>
          </Html>
        ) : null,
      )}

      {/* núcleos */}
      {engine.participants.map((p, i) => {
        const core = ISLANDS[p.island]!.core;
        const near =
          Math.hypot(engine.player.pos.x - core.x, engine.player.pos.z - core.z) < 16;
        return (
          <group key={`c${p.id}`} position={[core.x, 0, core.z]}>
            <group
              ref={(el) => {
                coreRefs.current[i] = el;
              }}
              position={[0, 1.5, 0]}
            >
              <mesh castShadow>
                <octahedronGeometry args={[1.4, 0]} />
                <meshStandardMaterial
                  color={p.color}
                  emissive={p.color}
                  emissiveIntensity={0.45}
                  flatShading
                />
              </mesh>
              <mesh>
                <octahedronGeometry args={[1.9, 0]} />
                <meshStandardMaterial color={p.color} transparent opacity={0.16} />
              </mesh>
            </group>
            <Html
              position={[0, 3.6, 0]}
              center
              distanceFactor={near ? 26 : 13}
              style={{ pointerEvents: "none", opacity: near ? 0.55 : 1 }}
            >
              <div className="whitespace-nowrap rounded-md bg-black/55 px-2 py-1 text-center text-[13px] font-bold text-white">
                <div>{p.name}</div>
                <div className="mt-0.5 h-1.5 w-24 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(p.coreHp / TUNING.coreMaxHp) * 100}%`,
                      background: p.coreHp > 0 ? p.color : "transparent",
                    }}
                  />
                </div>
                <div className="opacity-85">
                  {p.coreHp > 0 ? `${Math.round(p.coreHp)}/100` : "DESTRUÍDO"}
                </div>
              </div>
            </Html>
          </group>
        );
      })}

      {/* recursos no chão */}
      <group ref={pickupGroup}>
        {pickups.map((pk) => (
          <mesh key={pk.id} position={[pk.pos.x, pk.pos.y, pk.pos.z]} castShadow>
            <octahedronGeometry args={[0.38, 0]} />
            <meshStandardMaterial
              color="#59e7ff"
              emissive="#22b8d8"
              emissiveIntensity={0.45}
              metalness={0.4}
              roughness={0.35}
            />
          </mesh>
        ))}
      </group>

      {/* rastros de tiro */}
      {Array.from({ length: MAX_TRACERS }).map((_, i) => (
        <mesh
          key={`t${i}`}
          visible={false}
          ref={(el) => {
            tracerRefs.current[i] = el;
          }}
        >
          <boxGeometry args={[0.05, 0.05, 1]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </>
  );
}
