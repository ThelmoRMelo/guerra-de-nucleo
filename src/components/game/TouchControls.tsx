import { useEffect, useRef, useState } from "react";
import { Crosshair, RotateCcw, Store } from "lucide-react";
import { addLook, input, setJoystick } from "@/game/input";
import { useGame } from "@/game/store";

export function TouchControls() {
  const [isTouch, setIsTouch] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const padRef = useRef<HTMLDivElement>(null);
  const moveId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lastLook = useRef({ x: 0, y: 0 });

  const hud = useGame((s) => s.hud);
  const setShopOpen = useGame((s) => s.setShopOpen);
  const shopOpen = useGame((s) => s.shopOpen);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    if (!isTouch) return;

    const updateJoystick = (clientX: number, clientY: number) => {
      const pad = padRef.current;
      if (!pad) return;

      const rect = pad.getBoundingClientRect();

      // Centro geométrico REAL do analógico.
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;

      // Raio útil considerando o tamanho do botão interno.
      const knobRadius = 32;
      const max = Math.max(1, rect.width / 2 - knobRadius - 4);

      const distance = Math.hypot(dx, dy);

      if (distance > max) {
        dx = (dx / distance) * max;
        dy = (dy / distance) * max;
      }

      setKnob({ x: dx, y: dy });

      setJoystick(
        Math.max(-1, Math.min(1, dx / max)),
        Math.max(-1, Math.min(1, -dy / max)),
      );
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId === lookId.current) {
        addLook(
          e.clientX - lastLook.current.x,
          e.clientY - lastLook.current.y,
        );

        lastLook.current = {
          x: e.clientX,
          y: e.clientY,
        };
      }

      if (e.pointerId === moveId.current) {
        updateJoystick(e.clientX, e.clientY);
      }
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId === moveId.current) {
        moveId.current = null;

        setKnob({
          x: 0,
          y: 0,
        });

        setJoystick(0, 0);
      }

      if (e.pointerId === lookId.current) {
        lookId.current = null;
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isTouch]);

  if (!isTouch || shopOpen) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* Área de olhar — metade direita */}
      <div
        className="pointer-events-auto absolute inset-y-0 right-0 w-1/2"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          if (lookId.current === null) {
            lookId.current = e.pointerId;

            lastLook.current = {
              x: e.clientX,
              y: e.clientY,
            };

            e.currentTarget.setPointerCapture?.(e.pointerId);
          }
        }}
      />

      {/* ANALÓGICO VIRTUAL */}
      <div
        ref={padRef}
        className="pointer-events-auto absolute bottom-8 left-6 h-36 w-36 rounded-full border-4 border-white/35 bg-black/25 backdrop-blur-sm"
        style={{
          touchAction: "none",
          boxSizing: "border-box",
        }}
        onPointerDown={(e) => {
          moveId.current = e.pointerId;

          e.currentTarget.setPointerCapture?.(e.pointerId);

          // Atualiza imediatamente ao tocar,
          // sem precisar esperar o primeiro pointermove.
          const rect = e.currentTarget.getBoundingClientRect();

          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          let dx = e.clientX - centerX;
          let dy = e.clientY - centerY;

          const knobRadius = 32;
          const max = Math.max(1, rect.width / 2 - knobRadius - 4);

          const distance = Math.hypot(dx, dy);

          if (distance > max) {
            dx = (dx / distance) * max;
            dy = (dy / distance) * max;
          }

          setKnob({ x: dx, y: dy });

          setJoystick(
            Math.max(-1, Math.min(1, dx / max)),
            Math.max(-1, Math.min(1, -dy / max)),
          );
        }}
      >
        {/* BOTÃO DO ANALÓGICO */}
        <div
          className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full bg-white/70 shadow-lg"
          style={{
            transform: `translate(-50%, -50%) translate(${knob.x}px, ${knob.y}px)`,
          }}
        />
      </div>

      {/* BOTÕES */}
      <div className="pointer-events-auto absolute bottom-8 right-6 flex flex-col items-end gap-3">
        {hud?.nearShop && (
          <button
            className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/90 text-accent-foreground shadow-lg active:scale-95"
            onPointerDown={() => setShopOpen(true)}
            aria-label="Abrir loja"
          >
            <Store className="h-7 w-7" />
          </button>
        )}

        <button
          className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary/90 text-secondary-foreground shadow-lg active:scale-95"
          onPointerDown={() => {
            input.reloadPulse = true;
          }}
          aria-label="Recarregar"
        >
          <RotateCcw className="h-6 w-6" />
        </button>

        <button
          className="flex h-24 w-24 items-center justify-center rounded-full bg-destructive/90 text-destructive-foreground shadow-xl active:scale-95"
          onPointerDown={() => {
            input.shooting = true;
          }}
          onPointerUp={() => {
            input.shooting = false;
          }}
          onPointerLeave={() => {
            input.shooting = false;
          }}
          aria-label="Atirar"
        >
          <Crosshair className="h-10 w-10" />
        </button>
      </div>
    </div>
  );
}
