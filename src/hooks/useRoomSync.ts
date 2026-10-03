import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchConfirmedMatchPlayers, fetchRoom, fetchRoomPlayers, getLocalPlayerId, type RoomPlayerRow, type RoomRow } from "@/lib/room";
import { useGame } from "@/game/store";

export type RoomConnection = "conectando" | "online" | "offline";

const pendingMatchStarts = new Map<string, Promise<void>>();

export function startConfirmedRoomMatch(code: string): Promise<void> {
  const existing = pendingMatchStarts.get(code);
  if (existing) return existing;
  const pending = (async () => {
    const players = await fetchConfirmedMatchPlayers(code);
    const state = useGame.getState();
    if (state.roomCode !== code || state.screen !== "lobby") return;
    const localPlayer = players.find((player) => player.player_id === getLocalPlayerId());
    if (!localPlayer) throw new Error("Seu jogador não está mais nesta sala.");
    useGame.setState({
      teamColor: localPlayer.color,
      matchPlayers: players.map((player) => ({ playerId: player.player_id, name: player.name, color: player.color })),
    });
    useGame.getState().startMatch();
  })().finally(() => pendingMatchStarts.delete(code));
  pendingMatchStarts.set(code, pending);
  return pending;
}

/**
 * Mantém o lobby sincronizado com o servidor em tempo real.
 * O visitante apenas recebe regras e a ordem de início; o anfitrião é a autoridade.
 */
export function useRoomSync(code: string, active: boolean) {
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<RoomPlayerRow[]>([]);
  const [connection, setConnection] = useState<RoomConnection>("conectando");
  const [notice, setNotice] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || !code) return;
    let cancelled = false;
    startedRef.current = false;

    const apply = (r: RoomRow | null) => {
      if (cancelled || !r) return;
      setRoom(r);
      const state = useGame.getState();
      if (!state.isRoomHost) {
        useGame.setState({
          botDifficulty: r.bot_difficulty,
          fillEmptySlotsWithBots: r.fill_with_bots,
          coreRestorationEnabled: r.core_restoration,
          teamMode: r.team_mode,
        });
      }
      if (r.status === "closed") {
        setNotice("O anfitrião encerrou a sala.");
        return;
      }
      if (r.status === "started" && !startedRef.current) {
        startedRef.current = true;
        void startConfirmedRoomMatch(code).catch((error: unknown) => {
          if (cancelled) return;
          startedRef.current = false;
          setNotice(error instanceof Error ? error.message : "Falha ao carregar os jogadores. Tentando novamente.");
        });
      }
    };

    const refresh = async () => {
      const [r, p] = await Promise.all([fetchRoom(code), fetchRoomPlayers(code)]);
      if (cancelled) return;
      if (!r) {
        setNotice("Sala não encontrada.");
        setConnection("offline");
        return;
      }
      setPlayers(p);
      if (!startedRef.current && useGame.getState().screen === "lobby" && r.status === "lobby") {
        useGame.getState().setMatchPlayers(
          p.map((player) => ({ playerId: player.player_id, name: player.name, color: player.color })),
        );
      }
      apply(r);
    };

    void refresh();

    const channel = supabase
      .channel(`room:${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        (payload) => apply(payload.new as RoomRow),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_players", filter: `room_code=eq.${code}` },
        () => {
          void fetchRoomPlayers(code).then((p) => {
            if (cancelled) return;
            setPlayers(p);
            if (!startedRef.current && useGame.getState().screen === "lobby") {
              useGame.getState().setMatchPlayers(
                p.map((player) => ({ playerId: player.player_id, name: player.name, color: player.color })),
              );
            }
          });
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") setConnection("online");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED")
          setConnection("offline");
      });

    // Reconexão / rede instável: sincronização periódica de segurança.
    const poll = window.setInterval(() => void refresh(), 4000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [code, active]);

  return { room, players, connection, notice };
}
