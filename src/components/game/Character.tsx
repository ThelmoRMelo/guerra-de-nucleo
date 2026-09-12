import { forwardRef } from "react";
import * as THREE from "three";
import type { SkinId } from "@/game/config";

interface Props {
  color: string;
  skin?: SkinId;
  hidden?: boolean;
}

/** Personagem cartunesco: cabeça redonda, corpo cilíndrico, braços e pernas simples. */
export const Character = forwardRef<THREE.Group, Props>(function Character({ color, skin = "classico" }, ref) {
  const classic = skin === "classico";
  const animal = skin === "raposa" ? "#ba7a48" : skin === "panda" ? "#f4f4f4" : skin === "coruja" ? "#a97142" : skin === "tigre" ? "#a7aab2" : "#ffd9b3";
  const bodyColor = classic ? color : animal;
  const eyeWhite = skin === "coruja" ? "#ffd85a" : "#ffffff";
  return (
    <group ref={ref}>
      <group name="body">
        <mesh position={[0, classic ? 1.55 : 1.58, 0]} castShadow name="head">
          <sphereGeometry args={[classic ? 0.42 : 0.5, 20, 16]} />
          <meshStandardMaterial color={animal} roughness={0.7} />
        </mesh>
        {/* Cachorro: orelhas caídas; gato: orelhas triangulares altas. */}
        {skin === "raposa" ? [-0.35, 0.35].map((x) => <mesh key={`dog-ear-${x}`} position={[x, 1.78, 0]} rotation={[0, 0, x < 0 ? 0.55 : -0.55]}><capsuleGeometry args={[0.13, 0.32, 4, 8]} /><meshStandardMaterial color="#8c542f" /></mesh>) : null}
        {skin === "tigre" ? [-0.28, 0.28].map((x) => <mesh key={`cat-ear-${x}`} position={[x, 2.03, 0]}><coneGeometry args={[0.17, 0.36, 4]} /><meshStandardMaterial color={animal} /></mesh>) : null}
        {skin === "panda" ? <><mesh position={[-0.25, 1.86, 0]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#222" /></mesh><mesh position={[0.25, 1.86, 0]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#222" /></mesh></> : null}
        {/* Rosto estilizado: cada animal sempre tem exatamente dois olhos e duas pupilas. */}
        {!classic && [-0.16, 0.16].map((x) => (
          <group key={`animal-eye-${x}`} position={[x, 1.64, -0.485]}>
            {skin === "panda" && <mesh><sphereGeometry args={[0.16, 12, 10]} /><meshStandardMaterial color="#242424" /></mesh>}
            <mesh position={[0, 0, -0.035]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial color={eyeWhite} /></mesh>
            <mesh position={[0, 0, -0.12]}><sphereGeometry args={[0.052, 12, 10]} /><meshStandardMaterial color="#12121b" /></mesh>
            <mesh position={[-0.018, 0.025, -0.16]}><sphereGeometry args={[0.016, 8, 6]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.2} /></mesh>
          </group>
        ))}
        {classic && [-0.15, 0.15].map((x) => <mesh key={`classic-eye-${x}`} position={[x, 1.6, -0.405]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color="#2b2440" /></mesh>)}
        {skin === "coruja" ? <mesh position={[0, 1.47, -0.52]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.13, 0.32, 4]} /><meshStandardMaterial color="#f6c542" /></mesh> : null}
        {skin === "raposa" || skin === "tigre" ? <mesh position={[0, 1.46, -0.5]}><sphereGeometry args={[0.13, 12, 8]} /><meshStandardMaterial color={skin === "raposa" ? "#2a1a18" : "#6b321d"} /></mesh> : null}
        {classic && <mesh position={[0, 1.82, 0]} castShadow>
          <sphereGeometry args={[0.44, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>}
        <mesh position={[0, 0.95, 0]} castShadow name="torso">
          <cylinderGeometry args={[0.34, 0.38, 0.85, 14]} />
          <meshStandardMaterial color={bodyColor} roughness={0.75} />
        </mesh>
        <mesh name="armL" position={[0.45, 1.05, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.45, 4, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.75} />
        </mesh>
        <mesh name="armR" position={[-0.45, 1.05, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.45, 4, 8]} />
          <meshStandardMaterial color={bodyColor} roughness={0.75} />
        </mesh>
        <mesh name="legL" position={[0.17, 0.3, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
          <meshStandardMaterial color={classic ? "#3d3350" : bodyColor} roughness={0.75} />
        </mesh>
        <mesh name="legR" position={[-0.17, 0.3, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
          <meshStandardMaterial color={classic ? "#3d3350" : bodyColor} roughness={0.75} />
        </mesh>
        {/* Caudas simples reforçam a leitura do cachorro e gato mesmo à distância. */}
        {skin === "raposa" ? <mesh position={[0, 0.95, 0.36]} rotation={[0.7, 0, 0]}><capsuleGeometry args={[0.12, 0.55, 4, 8]} /><meshStandardMaterial color="#8c542f" /></mesh> : null}
        {skin === "tigre" ? <mesh position={[0, 0.92, 0.36]} rotation={[0.9, 0, 0]}><capsuleGeometry args={[0.09, 0.62, 4, 8]} /><meshStandardMaterial color={animal} /></mesh> : null}
        {/* Pelagens no corpo: o uniforme só pertence ao personagem clássico. */}
        {skin === "panda" ? <><mesh position={[-0.36, 1.05, 0]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#202020" /></mesh><mesh position={[0.36, 1.05, 0]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#202020" /></mesh><mesh position={[0, 0.72, -0.37]}><sphereGeometry args={[0.2, 12, 8]} /><meshStandardMaterial color="#202020" /></mesh></> : null}
        {skin === "raposa" ? <mesh position={[0, 0.82, -0.38]}><sphereGeometry args={[0.22, 12, 8]} /><meshStandardMaterial color="#f3dfc6" /></mesh> : null}
        {skin === "coruja" ? <>{[-0.18, 0, 0.18].map((x) => <mesh key={`owl-feather-${x}`} position={[x, 1.02, -0.37]}><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial color="#efd2a2" /></mesh>)}</> : null}
        {/* arma */}
        <group name="gun" position={[0.42, 1.15, -0.45]}>
          <mesh castShadow>
            <boxGeometry args={[0.13, 0.16, 0.62]} />
            <meshStandardMaterial color="#33304a" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.16, 0.12]}>
            <boxGeometry args={[0.11, 0.22, 0.16]} />
            <meshStandardMaterial color="#22203a" roughness={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  );
});
