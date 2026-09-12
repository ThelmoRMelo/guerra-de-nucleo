import { Mic, MicOff } from "lucide-react";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { useGame } from "@/game/store";

export function VoiceChatControl() {
  const roomCode = useGame((s) => s.roomCode);
  const matchPlayers = useGame((s) => s.matchPlayers);
  const { enabled, error, toggle } = useVoiceChat();

  if (!roomCode || matchPlayers.length < 2) return null;

  return (
    <div className="pointer-events-auto absolute left-1/2 top-3 z-20 -translate-x-1/2 md:left-3 md:top-40 md:translate-x-0">
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black text-hud-text shadow-lg transition-colors ${
          enabled ? "bg-emerald-700/90 hover:bg-emerald-600" : "bg-hud-panel/90 hover:bg-hud-panel"
        }`}
        aria-pressed={enabled}
      >
        {enabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        CHAT DE VOZ: {enabled ? "HABILITADO" : "DESABILITADO"}
      </button>
      {error && <p className="mt-2 max-w-60 rounded-md bg-destructive/90 px-2 py-1 text-xs font-bold text-white">{error}</p>}
    </div>
  );
}
