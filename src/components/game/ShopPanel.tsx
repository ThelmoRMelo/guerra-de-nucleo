import { useState } from "react";
import { X } from "lucide-react";
import { UPGRADES, WEAPONS, type UpgradeId, type WeaponId } from "@/game/config";
import { useGame } from "@/game/store";
import type { GameEngine } from "@/game/engine";

export function ShopPanel({ engine }: { engine: GameEngine }) {
  const shopOpen = useGame((s) => s.shopOpen);
  const setShopOpen = useGame((s) => s.setShopOpen);
  const hud = useGame((s) => s.hud);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"armas" | "melhorias">("armas");

  if (!shopOpen || !hud) return null;
  const p = engine.player;

  const fail = () => {
    setMsg("RECURSOS INSUFICIENTES");
    setTimeout(() => setMsg(""), 1400);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex cursor-default items-center justify-center bg-black/65 p-4 font-display"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => setShopOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black">COMERCIANTE</h2>
          <div className="flex items-center gap-3 text-sm font-bold">
            <span className="text-diamond">💎 {hud.diamond}</span>
            <button onClick={() => setShopOpen(false)} aria-label="Fechar loja">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mb-3 flex gap-2">
          {(["armas", "melhorias"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1 text-sm font-bold uppercase ${
                tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {tab === "armas"
            ? (Object.keys(WEAPONS) as WeaponId[]).map((id) => {
                const w = WEAPONS[id];
                const owned = hud.owned.includes(id);
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 p-3"
                  >
                    <div>
                      <p className="font-bold">{w.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Dano {w.damage} · {w.shots} tiro(s) · cooldown {w.cooldown}s · alcance {w.range}m
                      </p>
                    </div>
                    {owned ? (
                      <button
                        className="btn-arcade-sm"
                        disabled={hud.weapon === id}
                        onClick={() => engine.equip(p, id)}
                      >
                        {hud.weapon === id ? "EQUIPADA" : "EQUIPAR"}
                      </button>
                    ) : (
                      <button
                        className="btn-arcade-sm"
                        onClick={() => {
                          if (!engine.buyWeapon(p, id)) fail();
                        }}
                      >
                        {w.price?.diamond}💎
                      </button>
                    )}
                  </div>
                );
              })
            : (Object.keys(UPGRADES) as UpgradeId[]).map((id) => {
                const u = UPGRADES[id];
                const level = hud.upgrades[id];
                const cost = engine.upgradeCost(p, id);
                const max = level >= u.maxLevel;
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 p-3"
                  >
                    <div>
                      <p className="font-bold">
                        {u.nome} <span className="text-xs text-muted-foreground">Nv {level}/{u.maxLevel}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{u.descricao}</p>
                    </div>
                    <button
                      className="btn-arcade-sm"
                      disabled={max}
                      onClick={() => {
                        if (!engine.buyUpgrade(p, id)) fail();
                      }}
                    >
                      {max ? "MÁX" : `${cost.diamond}💎`}
                    </button>
                  </div>
                );
              })}
        </div>

        {msg && <p className="mt-3 text-center text-sm font-bold text-destructive">{msg}</p>}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Pressione E ou toque fora para voltar à batalha
        </p>
      </div>
    </div>
  );
}
