import { useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Scene } from "./Scene";
import { HUD } from "./HUD";
import { TouchControls } from "./TouchControls";
import { ShopPanel } from "./ShopPanel";
import { GameEngine } from "@/game/engine";
import { attachDesktopInput, input, resetInput, setUiMode } from "@/game/input";
import { playSound, setSfxVolume } from "@/game/audio";
import { useGame } from "@/game/store";

export function GameCanvas() {
  const wrapper = useRef<HTMLDivElement>(null);
  const playerName = useGame((s) => s.playerName);
  const quality = useGame((s) => s.quality);
  const sfxVolume = useGame((s) => s.sfxVolume);
  const sensitivity = useGame((s) => s.sensitivity);
  const setEngine = useGame((s) => s.setEngine);
  const setPaused = useGame((s) => s.setPaused);
  const setShopOpen = useGame((s) => s.setShopOpen);

  const engine = useMemo(() => {
    const e = new GameEngine(playerName);
    e.onSound = playSound;
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setEngine(engine);
    setShopOpen(false);
    setPaused(false);
    resetInput();
    return () => setEngine(null);
  }, [engine, setEngine, setPaused, setShopOpen]);

  useEffect(() => setSfxVolume(sfxVolume), [sfxVolume]);
  useEffect(() => {
    input.sensitivity = sensitivity;
  }, [sensitivity]);

  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    input.touch = window.matchMedia("(pointer: coarse)").matches;
    if (input.touch) return;
    return attachDesktopInput(el, () => {
      setShopOpen(false);
      setPaused(true);
      document.exitPointerLock?.();
    });
  }, [setPaused, setShopOpen]);

  const dpr: [number, number] = quality === "baixa" ? [0.6, 1] : quality === "media" ? [1, 1.5] : [1, 2];

  return (
    <div ref={wrapper} className="fixed inset-0 touch-none select-none overflow-hidden">
      <Canvas
        shadows={quality !== "baixa"}
        dpr={dpr}
        camera={{ position: [0, 8, 12], fov: 62, far: 400 }}
        gl={{ antialias: quality === "alta" }}
      >
        <color attach="background" args={["#9ad5f2"]} />
        <fog attach="fog" args={["#a9dcf5", 90, 220]} />
        <hemisphereLight args={["#cfefff", "#6b7a5a", 0.75]} />
        <directionalLight
          position={[45, 70, 30]}
          intensity={1.6}
          castShadow={quality !== "baixa"}
          shadow-mapSize-width={quality === "alta" ? 2048 : 1024}
          shadow-mapSize-height={quality === "alta" ? 2048 : 1024}
          shadow-camera-left={-110}
          shadow-camera-right={110}
          shadow-camera-top={110}
          shadow-camera-bottom={-110}
        />
        <Environment>
          <Lightformer intensity={1.6} position={[0, 12, 0]} scale={[24, 24, 1]} />
          <Lightformer intensity={0.7} color="#8fd0ff" position={[-14, 3, -6]} rotation-y={Math.PI / 2} scale={[30, 6, 1]} />
        </Environment>
        <Scene engine={engine} />
      </Canvas>
      <HUD engine={engine} />
      <TouchControls />
      <ShopPanel engine={engine} />
    </div>
  );
}
