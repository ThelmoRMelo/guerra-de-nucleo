import { Diamond, Heart, Link2, Skull, Trophy } from "lucide-react";
import { WEAPONS } from "@/game/config";
import { useGame } from "@/game/store";
import type { GameEngine } from "@/game/engine";

export function HUD({ engine }: { engine: GameEngine }) {
  const hud = useGame((s) => s.hud);
  const paused = useGame((s) => s.paused);
  const setPaused = useGame((s) => s.setPaused);
  const setShopOpen = useGame((s) => s.setShopOpen);
  const startMatch = useGame((s) => s.startMatch);
  const exitToMenu = useGame((s) => s.exitToMenu);

  if (!hud) {
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <p className="rounded-lg bg-background/80 px-4 py-2 font-display text-lg">Carregando arena…</p>
      </div>
    );
  }

  const weapon = WEAPONS[hud.weapon];

  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-display">
      {/* mira */}
      {hud.alive && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-6 w-6 rounded-full border-2 border-hud-line/80" />
        </div>
      )}

      {/* topo esquerdo: vida e recursos */}
      <div className="absolute left-3 top-3 space-y-2">
        <div className="w-52 rounded-xl bg-hud-panel/80 p-2 backdrop-blur">
          <div className="flex items-center gap-2 text-sm text-hud-text">
            <Heart className="h-4 w-4 text-destructive" />
            <span className="font-bold">{hud.hp}/100</span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/40">
            <div className="h-full bg-destructive transition-all" style={{ width: `${hud.hp}%` }} />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-hud-text">
            <Link2 className="h-3.5 w-3.5 text-accent" /> NÚCLEO {hud.coreHp}/100
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/40">
            <div className="h-full bg-accent transition-all" style={{ width: `${hud.coreHp}%` }} />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 rounded-lg bg-hud-panel/80 px-2.5 py-1 text-sm font-bold text-hud-text backdrop-blur">
            <Diamond className="h-4 w-4 text-diamond" /> {hud.diamond}
          </div>
        </div>
      </div>

      {/* placar */}
      <div className="absolute right-3 top-3 w-44 rounded-xl bg-hud-panel/80 p-2 text-xs backdrop-blur">
        {hud.scoreboard.map((p) => (
          <div
            key={p.id}
            className={`flex items-center justify-between gap-2 py-0.5 ${p.eliminated ? "opacity-45 line-through" : ""}`}
          >
            <span className="flex items-center gap-1.5 truncate text-hud-text">
              <span style={{ color: p.color }}>●</span>
              {p.name}
              {p.isBot && <span className="text-[9px] opacity-60">BOT</span>}
            </span>
            <span className={p.coreHp > 0 ? "text-accent" : "text-destructive"}>
              {p.coreHp > 0 ? p.coreHp : "✕"}
            </span>
          </div>
        ))}
      </div>

      {/* arma */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl bg-hud-panel/80 px-4 py-2 text-center backdrop-blur">
        <div className="text-sm font-bold tracking-wide text-hud-text">🔫 {weapon.nome}</div>
        <div className="text-xs text-hud-text/80">
          {"∞"}
        </div>
      </div>

      {/* avisos */}
      <div className="absolute left-1/2 top-16 w-72 -translate-x-1/2 space-y-1 text-center">
        {hud.protectedNow && hud.alive && (
          <p className="rounded-full bg-accent/85 px-3 py-1 text-xs font-bold text-accent-foreground">
            PROTEÇÃO DE SPAWN
          </p>
        )}
        {hud.nearShop && (
          <p className="rounded-full bg-hud-panel/85 px-3 py-1 text-xs font-bold text-hud-text">
            [E] FALAR COM O COMERCIANTE
          </p>
        )}
        {hud.events.slice(-3).map((e, i) => (
          <p key={i} className="rounded-full bg-hud-panel/70 px-3 py-1 text-xs text-hud-text">
            {e}
          </p>
        ))}
      </div>

      {/* morte / respawn */}
      {!hud.alive && hud.status === "running" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-center">
          <Skull className="mb-3 h-12 w-12 text-destructive" />
          <h2 className="text-3xl font-black text-hud-text">
            {hud.eliminated ? "VOCÊ FOI ELIMINADO" : "VOCÊ MORREU"}
          </h2>
          {!hud.eliminated && (
            <p className="mt-2 text-lg text-hud-text/85">RENASCENDO EM {hud.respawnIn}…</p>
          )}
        </div>
      )}

      {/* fim de partida */}
      {hud.status !== "running" && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center">
          {hud.status === "victory" ? (
            <>
              <Trophy className="mb-3 h-14 w-14 text-diamond" />
              <h2 className="text-4xl font-black text-hud-text">🏆 VITÓRIA!</h2>
              <p className="mt-2 text-hud-text/85">Você foi o último sobrevivente.</p>
            </>
          ) : (
            <>
              <Skull className="mb-3 h-14 w-14 text-destructive" />
              <h2 className="text-4xl font-black text-hud-text">💀 DERROTA</h2>
              <p className="mt-2 text-hud-text/85">
                Seu núcleo foi destruído e você foi eliminado.
              </p>
            </>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button className="btn-arcade" onClick={startMatch}>
              JOGAR NOVAMENTE
            </button>
            <button className="btn-arcade-ghost" onClick={exitToMenu}>
              VOLTAR AO MENU
            </button>
          </div>
        </div>
      )}

      {/* pausa */}
      {paused && hud.status === "running" && (
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 text-center">
          <h2 className="text-3xl font-black text-hud-text">PAUSA</h2>
          <p className="text-sm text-hud-text/80">Abates: {engine.player.kills}</p>
          <button className="btn-arcade" onClick={() => setPaused(false)}>
            CONTINUAR
          </button>
          <button
            className="btn-arcade-ghost"
            onClick={() => {
              setShopOpen(false);
              exitToMenu();
            }}
          >
            SAIR DA PARTIDA
          </button>
        </div>
      )}
    </div>
  );
}
