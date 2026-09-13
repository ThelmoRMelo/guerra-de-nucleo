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
  godMode: boolean;
  coreShieldMode: boolean;
}

interface PlayerDamageEvent {
  target_player_id: string;
  source_player_id: string;
  amount: number;
}

interface CoreDamageEvent {
  target_player_id: string;
  source_player_id: string;
  amount: number;
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
    const stateForBroadcast = (): RemotePlayerState => {
      const player = engine.player;
      return {
        room_code: roomCode,
        player_id: playerId,
        pos_x: player.pos.x,
        pos_y: player.pos.y,
        pos_z: player.pos.z,
        yaw: player.yaw,
        moving: player.moving,
        godMode: player.godMode,
        coreShieldMode: player.coreShieldMode,
      };
    };
    const persist = (state: RemotePlayerState) => {
      void supabase.rpc("update_room_player_state", {
        p_code: roomCode,
        p_player_id: playerId,
        p_pos_x: state.pos_x,
        p_pos_y: state.pos_y,
        p_pos_z: state.pos_z,
        p_yaw: state.yaw,
        p_moving: state.moving,
      });
    };

    void supabase
      .from("room_player_states")
      .select("room_code, player_id, pos_x, pos_y, pos_z, yaw, moving")
      .eq("room_code", roomCode)
      .then(({ data }) => data?.forEach((state) => apply(state as RemotePlayerState)));

    const channel = supabase
      .channel(`match-position:${roomCode}`)
      .on("broadcast", { event: "player-state" }, ({ payload }) => apply(payload as RemotePlayerState))
      .on("broadcast", { event: "player-damage" }, ({ payload }) => {
        const event = payload as PlayerDamageEvent;
        // O atirador já aplicou o dano localmente; os demais replicam o mesmo acerto.
        if (event.source_player_id !== playerId) {
          engine.applyNetworkDamage(event.target_player_id, event.amount, event.source_player_id);
        }
      })
      .on("broadcast", { event: "core-damage" }, ({ payload }) => {
        const event = payload as CoreDamageEvent;
        // O atirador já reduziu o núcleo localmente; os demais copiam o resultado.
        if (event.source_player_id !== playerId) {
          engine.applyNetworkCoreDamage(event.target_player_id, event.amount, event.source_player_id);
        }
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_player_states", filter: `room_code=eq.${roomCode}` },
        (payload) => apply(payload.new as RemotePlayerState),
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        const state = stateForBroadcast();
        persist(state);
        void channel.send({ type: "broadcast", event: "player-state", payload: state });
      });

    engine.onHumanDamage = (targetPlayerId, amount, sourcePlayerId) => {
      void channel.send({
        type: "broadcast",
        event: "player-damage",
        payload: {
          target_player_id: targetPlayerId,
          source_player_id: sourcePlayerId,
          amount,
        } satisfies PlayerDamageEvent,
      });
    };
    engine.onHumanCoreDamage = (targetPlayerId, amount, sourcePlayerId) => {
      void channel.send({
        type: "broadcast",
        event: "core-damage",
        payload: {
          target_player_id: targetPlayerId,
          source_player_id: sourcePlayerId,
          amount,
        } satisfies CoreDamageEvent,
      });
    };

    // Broadcast mostra movimento imediatamente para quem já está na partida;
    // a RPC salva o mesmo estado para jogadores que entrarem depois.
    const timer = window.setInterval(() => {
      const state = stateForBroadcast();
      persist(state);
      void channel.send({ type: "broadcast", event: "player-state", payload: state });
    }, 100);

    return () => {
      disposed = true;
      engine.onHumanDamage = undefined;
      engine.onHumanCoreDamage = undefined;
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [engine, roomCode]);
}
