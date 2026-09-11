import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalPlayerId } from "@/lib/room";
import { useGame } from "@/game/store";
import type { GameEngine } from "@/game/engine";

interface RemotePlayerState {
  room_code: string;
  player_id: string;
  pos_x: number;
  pos_y: number;
  pos_z: number;
  yaw: number;
  moving: boolean;
}

/** Sincroniza somente o estado visual de movimento dos humanos da sala. */
export function useMatchPositionSync(engine: GameEngine) {
  const roomCode = useGame((s) => s.roomCode);

  useEffect(() => {
    if (!roomCode) return;
    const playerId = getLocalPlayerId();
    let disposed = false;

    const apply = (state: RemotePlayerState) => {
      if (!disposed && state.player_id !== playerId) engine.applyRemotePlayerState(state);
    };
    const publish = () => {
      const player = engine.player;
      void supabase.rpc("update_room_player_state", {
        p_code: roomCode,
        p_player_id: playerId,
        p_pos_x: player.pos.x,
        p_pos_y: player.pos.y,
        p_pos_z: player.pos.z,
        p_yaw: player.yaw,
        p_moving: player.moving,
      });
    };

    void supabase
      .from("room_player_states")
      .select("room_code, player_id, pos_x, pos_y, pos_z, yaw, moving")
      .eq("room_code", roomCode)
      .then(({ data }) => data?.forEach((state) => apply(state as RemotePlayerState)));

    const channel = supabase
      .channel(`match-position:${roomCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_player_states", filter: `room_code=eq.${roomCode}` },
        (payload) => apply(payload.new as RemotePlayerState),
      )
      .subscribe();
    publish();
    const timer = window.setInterval(publish, 100);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [engine, roomCode]);
}
