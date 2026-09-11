import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchRoom, fetchRoomPlayers, type RoomPlayerRow, type RoomRow } from "@/lib/room";
import { useGame } from "@/game/store";

export type RoomConnection = "conectando" | "online" | "offline";

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
        });
      }
      if (r.status === "closed") {
        setNotice("O anfitrião encerrou a sala.");
        return;
      }
      if (r.status === "started" && !startedRef.current) {
        startedRef.current = true;
        useGame.getState().startMatch();
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
          void fetchRoomPlayers(code).then((p) => !cancelled && setPlayers(p));
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
