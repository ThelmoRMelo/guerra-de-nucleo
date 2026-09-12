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
        {skin === "coruja" ? <mesh position={[0, 1.52, -0.4]}><coneGeometry args={[0.13, 0.3, 4]} rotation={[Math.PI / 2, 0, 0]} /><meshStandardMaterial color="#f6c542" /></mesh> : null}
        {/* Olhos grandes dos animais; o clássico preserva o rosto original. */}
        {!classic ? [0.15, -0.15].map((x) => <mesh key={`eye-base-${x}`} position={[x, 1.6, -0.37]}><sphereGeometry args={[0.115, 12, 10]} /><meshStandardMaterial color="#fff" /></mesh>) : null}
        {/* olhos */}
        <mesh position={[0.15, 1.6, -0.36]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color="#2b2440" />
        </mesh>
        <mesh position={[-0.15, 1.6, -0.36]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color="#2b2440" />
        </mesh>
        {skin === "tigre" ? [-0.18, 0, 0.18].map((x) => <mesh key={x} position={[x, 1.72, -0.38]}><boxGeometry args={[0.045, 0.28, 0.02]} /><meshStandardMaterial color="#4a2b19" /></mesh>) : null}
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
        {skin === "panda" ? <><mesh position={[-0.23, 1.58, -0.39]}><sphereGeometry args={[0.14, 12, 10]} /><meshStandardMaterial color="#202020" /></mesh><mesh position={[0.23, 1.58, -0.39]}><sphereGeometry args={[0.14, 12, 10]} /><meshStandardMaterial color="#202020" /></mesh></> : null}
        {skin === "raposa" ? <mesh position={[0, 1.47, -0.42]}><sphereGeometry args={[0.15, 12, 8]} /><meshStandardMaterial color="#fff2dc" /></mesh> : null}
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
