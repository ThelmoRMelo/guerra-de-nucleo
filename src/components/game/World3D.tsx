import { useMemo } from "react";
import { TUNING } from "@/game/config";
import { ISLANDS, PIRATE_PORTALS, PIRATE_SHIP, PIRATE_WALL_SEGMENTS } from "@/game/world";
import type { ArenaMap } from "@/game/store";

const GRASS = ["#63c66a", "#57bd8f", "#7ccf5e"];

export function World3D({ selectedMap }: { selectedMap: ArenaMap }) {
  const bridges = useMemo(
    () =>
      ISLANDS.map((isl) => {
        const len = TUNING.islandDistance - TUNING.centerRadius + 4;
        const mid = (TUNING.centerRadius + TUNING.islandDistance - 4) / 2;
        return {
          key: isl.index,
          pos: [Math.cos(isl.angle) * mid, -0.35, Math.sin(isl.angle) * mid] as [number, number, number],
          rot: -isl.angle,
          len,
        };
      }),
    [],
  );

  return (
    <group>
      {/* A Ilha do Núcleo tem centro terrestre; a Ilha Pirata o substitui por um navio. */}
      {selectedMap === "nucleo" && <group>
        <mesh position={[0, -0.5, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[TUNING.centerRadius, TUNING.centerRadius - 0.6, 1.2, 40]} />
          <meshStandardMaterial color="#e8c98a" roughness={0.9} />
        </mesh>
        <mesh position={[0, -4.5, 0]}>
          <coneGeometry args={[TUNING.centerRadius - 1, 8, 24]} />
          <meshStandardMaterial color="#8a6b4a" roughness={1} />
        </mesh>
        <mesh position={[0, 0.15, 0]} receiveShadow>
          <cylinderGeometry args={[TUNING.centerRadius - 4, TUNING.centerRadius - 4, 0.2, 32]} />
          <meshStandardMaterial color="#d8b673" roughness={1} />
        </mesh>
        {/* gerador central */}
        <group position={[0, 0, 0]}>
          <mesh position={[0, 1.1, 0]} castShadow>
            <cylinderGeometry args={[1.4, 1.9, 2.2, 8]} />
            <meshStandardMaterial color="#6f7bd6" roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, 2.9, 0]} castShadow>
            <octahedronGeometry args={[1.1, 0]} />
            <meshStandardMaterial color="#7ff0ff" emissive="#3fd8ef" emissiveIntensity={0.7} />
          </mesh>
        </group>
        {/* pedras decorativas */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2 + 0.3;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * (TUNING.centerRadius - 4), 0.5, Math.sin(a) * (TUNING.centerRadius - 4)]}
              rotation={[0.2, a, 0.1]}
              castShadow
            >
              <dodecahedronGeometry args={[0.9, 0]} />
              <meshStandardMaterial color="#9c8d7a" roughness={1} />
            </mesh>
          );
        })}
      </group>}

      {selectedMap === "pirata" && <PirateShip />}

      {/* pontes */}
      {bridges.map((b) => (
        <group key={b.key} position={b.pos} rotation={[0, b.rot, 0]}>
          <mesh receiveShadow castShadow>
            <boxGeometry args={[b.len, 0.4, TUNING.bridgeWidth]} />
            <meshStandardMaterial color="#b98a5c" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.35, TUNING.bridgeWidth / 2 - 0.15]}>
            <boxGeometry args={[b.len, 0.35, 0.25]} />
            <meshStandardMaterial color="#8e6440" roughness={1} />
          </mesh>
          <mesh position={[0, 0.35, -TUNING.bridgeWidth / 2 + 0.15]}>
            <boxGeometry args={[b.len, 0.35, 0.25]} />
            <meshStandardMaterial color="#8e6440" roughness={1} />
          </mesh>
        </group>
      ))}

      {/* ilhas */}
      {ISLANDS.map((isl) => (
        <group key={isl.index} position={[isl.center.x, 0, isl.center.z]}>
          <mesh position={[0, -0.5, 0]} receiveShadow castShadow>
            <cylinderGeometry args={[TUNING.islandRadius, TUNING.islandRadius - 0.8, 1.2, 28]} />
            <meshStandardMaterial color={GRASS[isl.index % GRASS.length]!} roughness={0.95} />
          </mesh>
          <mesh position={[0, -4, 0]}>
            <coneGeometry args={[TUNING.islandRadius - 0.9, 7, 18]} />
            <meshStandardMaterial color="#7d5c40" roughness={1} />
          </mesh>
          {/* base do núcleo */}
          <group position={[isl.core.x - isl.center.x, 0, isl.core.z - isl.center.z]}>
            <mesh position={[0, 0.15, 0]} receiveShadow>
              <cylinderGeometry args={[2.4, 2.7, 0.4, 16]} />
              <meshStandardMaterial color="#e7e2d4" roughness={0.9} />
            </mesh>
          </group>
          {/* comerciante: barraca */}
          <group position={[isl.shop.x - isl.center.x, 0, isl.shop.z - isl.center.z]}>
            <mesh position={[0, 0.9, 0]} castShadow>
              <boxGeometry args={[2.4, 1.6, 1.4]} />
              <meshStandardMaterial color="#f4e0c0" roughness={0.9} />
            </mesh>
            <mesh position={[0, 2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
              <coneGeometry args={[2.1, 1.1, 4]} />
              <meshStandardMaterial color="#e2604f" roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.05, -0.9]} castShadow>
              <sphereGeometry args={[0.36, 16, 12]} />
              <meshStandardMaterial color="#ffd9b3" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.5, -0.9]} castShadow>
              <cylinderGeometry args={[0.3, 0.34, 0.7, 12]} />
              <meshStandardMaterial color="#5b7fd6" roughness={0.8} />
            </mesh>
          </group>
          {/* geradora */}
          <group position={[isl.generator.x - isl.center.x, 0, isl.generator.z - isl.center.z]}>
            <mesh position={[0, 0.8, 0]} castShadow>
              <cylinderGeometry args={[0.9, 1.3, 1.6, 6]} />
              <meshStandardMaterial color="#8d95a8" roughness={0.6} metalness={0.35} />
            </mesh>
            <mesh position={[0, 1.9, 0]} castShadow>
              <torusGeometry args={[0.7, 0.14, 8, 20]} />
              <meshStandardMaterial color="#ffd166" emissive="#ffae2b" emissiveIntensity={0.5} />
            </mesh>
          </group>
          {/* árvores decorativas */}
          {[0, 1, 2].map((i) => {
            const a = isl.angle + Math.PI / 2 + (i - 1) * 0.55;
            const r = TUNING.islandRadius - 2.2;
            return (
              <group key={i} position={[Math.cos(a) * r, 0, Math.sin(a) * r]}>
                <mesh position={[0, 0.7, 0]} castShadow>
                  <cylinderGeometry args={[0.18, 0.24, 1.4, 8]} />
                  <meshStandardMaterial color="#8a5d3b" roughness={1} />
                </mesh>
                <mesh position={[0, 1.9, 0]} castShadow>
                  <icosahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial color="#2f9e5c" roughness={0.95} flatShading />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

/** Navio aberto: o jogador entra pelo convés e circula no interior. */
function PirateShip() {
  const skulls = Array.from({ length: 10 }, (_, i) => {
    const a = i * 1.91;
    const r = 19 + (i % 2) * 7;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });

  const wallMaterial = (
    <meshStandardMaterial color="#2e160d" roughness={0.9} />
  );

  const woodMaterial = (
    <meshStandardMaterial color="#5b321b" roughness={0.9} />
  );

  return (
    <group>
      {/* Convés */}
      <mesh position={[0, -0.5, 0]} receiveShadow castShadow>
        <boxGeometry args={[70, 1, 42]} />
        {woodMaterial}
      </mesh>

      {/* Muralha sólida calculada como complemento exato dos oito portais. */}
      {PIRATE_WALL_SEGMENTS.map((segment, index) => (
        <mesh
          key={`wall-${segment.side}-${index}`}
          position={[segment.x, PIRATE_SHIP.wallHeight / 2 - 0.2, segment.z]}
          rotation={[0, segment.rotation, 0]}
          castShadow
        >
          <boxGeometry args={[segment.length, PIRATE_SHIP.wallHeight, PIRATE_SHIP.wallThickness]} />
          {wallMaterial}
        </mesh>
      ))}

      {/* Molduras dos acessos, centradas nas mesmas direções radiais das pontes. */}
      {PIRATE_PORTALS.map((portal) => (
        <group
          key={`door-${portal.index}`}
          position={[portal.x, 0, portal.z]}
          rotation={[0, portal.wallRotation, 0]}
        >
          {/* Pilar esquerdo */}
          <mesh
            position={[-portal.openingWidth / 2 - 0.4, 2.2, 0]}
            castShadow
          >
            <boxGeometry args={[0.8, 4.8, 1.5]} />
            {wallMaterial}
          </mesh>

          {/* Pilar direito */}
          <mesh
            position={[portal.openingWidth / 2 + 0.4, 2.2, 0]}
            castShadow
          >
            <boxGeometry args={[0.8, 4.8, 1.5]} />
            {wallMaterial}
          </mesh>

          {/* Parte superior */}
          <mesh
            position={[0, 4.6, 0]}
            castShadow
          >
            <boxGeometry args={[portal.openingWidth + 2.4, 0.8, 1.5]} />
            {wallMaterial}
          </mesh>

          {/* Tochas laterais */}
          <mesh
            position={[-portal.openingWidth / 2 - 1.1, 2.8, 0]}
            castShadow
          >
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshStandardMaterial
              color="#ff9d32"
              emissive="#ff5a00"
              emissiveIntensity={1.5}
            />
          </mesh>

          <mesh
            position={[portal.openingWidth / 2 + 1.1, 2.8, 0]}
            castShadow
          >
            <sphereGeometry args={[0.35, 8, 8]} />
            <meshStandardMaterial
              color="#ff9d32"
              emissive="#ff5a00"
              emissiveIntensity={1.5}
            />
          </mesh>
        </group>
      ))}

      {/* ========================= */}
      {/* MASTRO */}
      {/* ========================= */}

      <mesh position={[0, 7, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.7, 15, 10]} />
        <meshStandardMaterial color="#4a260f" />
      </mesh>

      {/* VELA */}
      <mesh
        position={[6, 8.5, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <planeGeometry args={[14, 13]} />
        <meshStandardMaterial color="#d8c29a" />
      </mesh>

      {/* VELA VERMELHA */}
      <mesh
        position={[-6, 7.8, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <planeGeometry args={[12, 11]} />
        <meshStandardMaterial color="#b93232" />
      </mesh>

      {/* NÚCLEO CENTRAL */}
      <mesh position={[0, 1.6, 0]}>
        <octahedronGeometry args={[1.1, 0]} />
        <meshStandardMaterial
          color="#7ff0ff"
          emissive="#3fd8ef"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* ========================= */}
      {/* CAVEIRAS */}
      {/* ========================= */}

      {skulls.map(([x, z], i) => (
        <group
          key={`skull-${i}`}
          position={[x, 0.7, z]}
        >
          <mesh castShadow>
            <sphereGeometry args={[0.65, 10, 8]} />
            <meshStandardMaterial color="#e8dfc8" />
          </mesh>

          <mesh
            position={[-0.22, 0.05, 0.55]}
          >
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#15100c" />
          </mesh>

          <mesh
            position={[0.22, 0.05, 0.55]}
          >
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#15100c" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
