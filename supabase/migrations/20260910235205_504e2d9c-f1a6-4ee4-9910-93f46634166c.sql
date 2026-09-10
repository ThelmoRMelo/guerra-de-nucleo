
CREATE TABLE public.rooms (
  code text PRIMARY KEY,
  host_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby','started','closed')),
  bot_difficulty text NOT NULL DEFAULT 'normal' CHECK (bot_difficulty IN ('facil','normal','dificil')),
  fill_with_bots boolean NOT NULL DEFAULT true,
  core_restoration boolean NOT NULL DEFAULT true,
  max_players integer NOT NULL DEFAULT 8,
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  slot integer NOT NULL,
  is_host boolean NOT NULL DEFAULT false,
  connected boolean NOT NULL DEFAULT true,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_code, player_id),
  UNIQUE (room_code, slot),
  UNIQUE (room_code, color)
);

CREATE INDEX room_players_room_idx ON public.room_players (room_code);

GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT SELECT ON public.room_players TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.room_players TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Salas visíveis para todos" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Participantes visíveis para todos" ON public.room_players FOR SELECT TO anon, authenticated USING (true);

-- Criar sala
CREATE OR REPLACE FUNCTION public.create_room(
  p_code text, p_host_id uuid, p_name text, p_color text,
  p_bot_difficulty text, p_fill_with_bots boolean, p_core_restoration boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code);
BEGIN
  IF EXISTS (SELECT 1 FROM rooms WHERE code = v_code) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_taken');
  END IF;
  INSERT INTO rooms (code, host_id, bot_difficulty, fill_with_bots, core_restoration)
  VALUES (v_code, p_host_id, p_bot_difficulty, p_fill_with_bots, p_core_restoration);
  INSERT INTO room_players (room_code, player_id, name, color, slot, is_host)
  VALUES (v_code, p_host_id, p_name, p_color, 0, true);
  RETURN jsonb_build_object('ok', true, 'code', v_code);
END; $$;

-- Entrar na sala
CREATE OR REPLACE FUNCTION public.join_room(
  p_code text, p_player_id uuid, p_name text, p_color text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := upper(p_code);
  v_room rooms%ROWTYPE;
  v_slot integer;
  v_color text := p_color;
  v_used text[];
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = v_code;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_room.status = 'closed' THEN RETURN jsonb_build_object('ok', false, 'error', 'closed'); END IF;

  IF EXISTS (SELECT 1 FROM room_players WHERE room_code = v_code AND player_id = p_player_id) THEN
    UPDATE room_players SET connected = true, name = p_name WHERE room_code = v_code AND player_id = p_player_id;
    RETURN jsonb_build_object('ok', true, 'status', v_room.status, 'rejoined', true);
  END IF;

  IF v_room.status = 'started' THEN RETURN jsonb_build_object('ok', false, 'error', 'already_started'); END IF;

  IF (SELECT count(*) FROM room_players WHERE room_code = v_code) >= v_room.max_players THEN
    RETURN jsonb_build_object('ok', false, 'error', 'full');
  END IF;

  SELECT coalesce(max(slot) + 1, 0) INTO v_slot FROM room_players WHERE room_code = v_code;
  SELECT array_agg(color) INTO v_used FROM room_players WHERE room_code = v_code;
  IF v_color = ANY (coalesce(v_used, ARRAY[]::text[])) THEN
    v_color := v_color || '#' || v_slot::text;
  END IF;

  INSERT INTO room_players (room_code, player_id, name, color, slot, is_host)
  VALUES (v_code, p_player_id, p_name, v_color, v_slot, false);
  RETURN jsonb_build_object('ok', true, 'status', v_room.status, 'color', v_color);
END; $$;

-- Atualizar regras (somente anfitrião)
CREATE OR REPLACE FUNCTION public.update_room_settings(
  p_code text, p_host_id uuid, p_bot_difficulty text, p_fill_with_bots boolean, p_core_restoration boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code); v_rows integer;
BEGIN
  UPDATE rooms SET bot_difficulty = p_bot_difficulty, fill_with_bots = p_fill_with_bots,
    core_restoration = p_core_restoration, updated_at = now()
  WHERE code = v_code AND host_id = p_host_id AND status = 'lobby';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started'); END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Iniciar partida (somente anfitrião)
CREATE OR REPLACE FUNCTION public.start_room_match(p_code text, p_host_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code); v_rows integer;
BEGIN
  UPDATE rooms SET status = 'started', started_at = now(), updated_at = now()
  WHERE code = v_code AND host_id = p_host_id AND status = 'lobby';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started'); END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- Sair da sala
CREATE OR REPLACE FUNCTION public.leave_room(p_code text, p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code); v_is_host boolean;
BEGIN
  SELECT is_host INTO v_is_host FROM room_players WHERE room_code = v_code AND player_id = p_player_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true); END IF;
  DELETE FROM room_players WHERE room_code = v_code AND player_id = p_player_id;
  IF v_is_host THEN
    UPDATE rooms SET status = 'closed', updated_at = now() WHERE code = v_code AND status <> 'started';
  END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.create_room(text, uuid, text, text, text, boolean, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_room(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_room_settings(text, uuid, text, boolean, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_room_match(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_room(text, uuid) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_players REPLICA IDENTITY FULL;
