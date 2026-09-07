import { forwardRef } from "react";
import * as THREE from "three";

interface Props {
  color: string;
  hidden?: boolean;
}

/** Personagem cartunesco: cabeça redonda, corpo cilíndrico, braços e pernas simples. */
export const Character = forwardRef<THREE.Group, Props>(function Character({ color }, ref) {
  return (
    <group ref={ref}>
      <group name="body">
        <mesh position={[0, 1.55, 0]} castShadow name="head">
          <sphereGeometry args={[0.42, 20, 16]} />
          <meshStandardMaterial color="#ffd9b3" roughness={0.7} />
        </mesh>
        {/* olhos */}
        <mesh position={[0.15, 1.6, -0.36]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color="#2b2440" />
        </mesh>
        <mesh position={[-0.15, 1.6, -0.36]}>
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshStandardMaterial color="#2b2440" />
        </mesh>
        <mesh position={[0, 1.82, 0]} castShadow>
          <sphereGeometry args={[0.44, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.95, 0]} castShadow name="torso">
          <cylinderGeometry args={[0.34, 0.38, 0.85, 14]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        <mesh name="armL" position={[0.45, 1.05, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.45, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        <mesh name="armR" position={[-0.45, 1.05, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.45, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        <mesh name="legL" position={[0.17, 0.3, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
          <meshStandardMaterial color="#3d3350" roughness={0.7} />
        </mesh>
        <mesh name="legR" position={[-0.17, 0.3, 0]} castShadow>
          <capsuleGeometry args={[0.12, 0.4, 4, 8]} />
          <meshStandardMaterial color="#3d3350" roughness={0.7} />
        </mesh>
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
