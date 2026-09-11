import { supabase } from "@/integrations/supabase/client";
import type { BotDifficulty } from "@/game/store";

export interface RoomRow {
  code: string;
  host_id: string;
  status: "lobby" | "started" | "closed";
  bot_difficulty: BotDifficulty;
  fill_with_bots: boolean;
  core_restoration: boolean;
  max_players: number;
  started_at: string | null;
}

export interface RoomPlayerRow {
  id: string;
  room_code: string;
  player_id: string;
  name: string;
  color: string;
  slot: number;
  is_host: boolean;
  connected: boolean;
}

const PLAYER_ID_KEY = "nucleo:playerId";

export function getLocalPlayerId(): string {
  try {
    const saved = localStorage.getItem(PLAYER_ID_KEY);
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

type RpcResult = { ok: boolean; error?: string; status?: string; color?: string };

async function callRpc(fn: string, args: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) return { ok: false, error: "network" };
  return (data ?? { ok: false, error: "network" }) as RpcResult;
}

export const ROOM_ERRORS: Record<string, string> = {
  not_found: "Sala não encontrada. Confira o código.",
  closed: "Esta sala foi encerrada pelo anfitrião.",
  already_started: "A partida já foi iniciada.",
  full: "A sala está cheia.",
  code_taken: "Código já em uso. Tente novamente.",
  not_host_or_started: "Apenas o anfitrião pode alterar isso.",
  color_taken: "Esta cor acabou de ser escolhida. Selecione outra.",
  invalid_color: "Selecione uma cor válida da paleta.",
  invalid_player_colors: "Todos os jogadores precisam ter cores únicas antes de iniciar.",
  network: "Falha de conexão. Tente novamente.",
};

export function roomErrorMessage(code?: string) {
  return (code && ROOM_ERRORS[code]) || ROOM_ERRORS["network"]!;
}

export async function createRoom(opts: {
  hostId: string;
  name: string;
  color: string;
  botDifficulty: BotDifficulty;
  fillWithBots: boolean;
  coreRestoration: boolean;
}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomRoomCode();
    const res = await callRpc("create_room", {
      p_code: code,
      p_host_id: opts.hostId,
      p_name: opts.name,
      p_color: opts.color,
      p_bot_difficulty: opts.botDifficulty,
      p_fill_with_bots: opts.fillWithBots,
      p_core_restoration: opts.coreRestoration,
    });
    if (res.ok) return { ok: true as const, code };
    if (res.error !== "code_taken") return { ok: false as const, error: res.error };
  }
  return { ok: false as const, error: "code_taken" };
}

export function joinRoom(code: string, playerId: string, name: string, color: string) {
  return callRpc("join_room", {
    p_code: code.toUpperCase(),
    p_player_id: playerId,
    p_name: name,
    p_color: color,
  });
}

export function updateRoomPlayerColor(code: string, playerId: string, color: string) {
  return callRpc("update_room_player_color", {
    p_code: code.toUpperCase(),
    p_player_id: playerId,
    p_color: color,
  });
}

export function updateRoomSettings(
  code: string,
  hostId: string,
  settings: { botDifficulty: BotDifficulty; fillWithBots: boolean; coreRestoration: boolean },
) {
  return callRpc("update_room_settings", {
    p_code: code,
    p_host_id: hostId,
    p_bot_difficulty: settings.botDifficulty,
    p_fill_with_bots: settings.fillWithBots,
    p_core_restoration: settings.coreRestoration,
  });
}

export function startRoomMatch(code: string, hostId: string) {
  return callRpc("start_room_match", { p_code: code, p_host_id: hostId });
}

export function leaveRoom(code: string, playerId: string) {
  return callRpc("leave_room", { p_code: code, p_player_id: playerId });
}

export async function fetchRoom(code: string) {
  const { data } = await supabase.from("rooms").select("*").eq("code", code).maybeSingle();
  return (data as RoomRow | null) ?? null;
}

export async function fetchRoomPlayers(code: string) {
  const { data } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_code", code)
    .order("slot", { ascending: true });
  return (data as RoomPlayerRow[] | null) ?? [];
}
