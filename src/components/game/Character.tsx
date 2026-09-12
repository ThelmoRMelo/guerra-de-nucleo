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
  const animal = skin === "raposa" ? "#e97831" : skin === "panda" ? "#f4f4f4" : skin === "coruja" ? "#a97142" : skin === "tigre" ? "#f2a536" : "#ffd9b3";
  const bodyColor = classic ? color : animal;
  const eyeWhite = skin === "coruja" ? "#ffd85a" : "#ffffff";
  return (
    <group ref={ref}>
      <group name="body">
        <mesh position={[0, 1.55, 0]} castShadow name="head">
          <sphereGeometry args={[0.42, 20, 16]} />
          <meshStandardMaterial color={animal} roughness={0.7} />
        </mesh>
        {skin === "raposa" || skin === "tigre" ? (
          <>
            {[-0.24, 0.24].map((x) => <mesh key={x} position={[x, 1.97, 0]}><coneGeometry args={[0.18, 0.38, 4]} /><meshStandardMaterial color={animal} /></mesh>)}
          </>
        ) : null}
        {skin === "panda" ? <><mesh position={[-0.25, 1.86, 0]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#222" /></mesh><mesh position={[0.25, 1.86, 0]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#222" /></mesh></> : null}
        {/* Rosto estilizado: cada animal sempre tem exatamente dois olhos e duas pupilas. */}
        {!classic && [-0.16, 0.16].map((x) => (
          <group key={`animal-eye-${x}`} position={[x, 1.62, -0.405]}>
            {skin === "panda" && <mesh><sphereGeometry args={[0.16, 12, 10]} /><meshStandardMaterial color="#242424" /></mesh>}
            <mesh position={[0, 0, -0.035]}><sphereGeometry args={[0.11, 12, 10]} /><meshStandardMaterial color={eyeWhite} /></mesh>
            <mesh position={[0, 0, -0.12]}><sphereGeometry args={[0.052, 12, 10]} /><meshStandardMaterial color="#12121b" /></mesh>
            <mesh position={[-0.018, 0.025, -0.16]}><sphereGeometry args={[0.016, 8, 6]} /><meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.2} /></mesh>
          </group>
        ))}
        {classic && [-0.15, 0.15].map((x) => <mesh key={`classic-eye-${x}`} position={[x, 1.6, -0.405]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color="#2b2440" /></mesh>)}
        {skin === "coruja" ? <mesh position={[0, 1.46, -0.43]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.13, 0.32, 4]} /><meshStandardMaterial color="#f6c542" /></mesh> : null}
        {skin === "raposa" || skin === "tigre" ? <mesh position={[0, 1.45, -0.41]}><sphereGeometry args={[0.13, 12, 8]} /><meshStandardMaterial color={skin === "raposa" ? "#2a1a18" : "#6b321d"} /></mesh> : null}
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
        {/* Pelagens no corpo: o uniforme só pertence ao personagem clássico. */}
        {skin === "tigre" ? [-0.22, 0, 0.22].map((x) => <mesh key={`tiger-body-${x}`} position={[x, 1.02, -0.37]}><boxGeometry args={[0.045, 0.62, 0.025]} /><meshStandardMaterial color="#4a2b19" /></mesh>) : null}
        {skin === "panda" ? <><mesh position={[-0.36, 1.05, 0]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#202020" /></mesh><mesh position={[0.36, 1.05, 0]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color="#202020" /></mesh><mesh position={[0, 0.72, -0.37]}><sphereGeometry args={[0.2, 12, 8]} /><meshStandardMaterial color="#202020" /></mesh></> : null}
        {skin === "raposa" ? <mesh position={[0, 0.82, -0.38]}><sphereGeometry args={[0.22, 12, 8]} /><meshStandardMaterial color="#fff2dc" /></mesh> : null}
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
