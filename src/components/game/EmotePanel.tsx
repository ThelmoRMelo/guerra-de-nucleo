import { useGame } from "@/game/store";
import type { GameEngine } from "@/game/engine";

const EMOTES = ["😀", "😂", "😍", "😎", "😡", "😭", "🤔", "😱", "👏", "🔥", "💥", "❤️"];

export function EmotePanel({ engine }: { engine: GameEngine }) {
  const emoteOpen = useGame((s) => s.emoteOpen);
  const setEmoteOpen = useGame((s) => s.setEmoteOpen);

  if (!emoteOpen) return null;

  const selectEmote = (emote: string) => {
    engine.sendEmote(engine.player, emote);
    setEmoteOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 font-display"
      onClick={() => setEmoteOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-5 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-black">REAÇÕES</h2>
        <p className="mt-1 text-xs text-muted-foreground">Escolha um emoji para mostrar por 4 segundos</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {EMOTES.map((emote) => (
            <button
              key={emote}
              type="button"
              className="rounded-xl bg-muted p-3 text-3xl transition-transform hover:scale-110 hover:bg-accent/30"
              onClick={() => selectEmote(emote)}
              aria-label={`Enviar ${emote}`}
            >
              {emote}
            </button>
          ))}
        </div>
        <button className="btn-arcade-ghost mt-4 w-full" onClick={() => setEmoteOpen(false)}>
          CANCELAR
        </button>
      </div>
    </div>
  );
}
