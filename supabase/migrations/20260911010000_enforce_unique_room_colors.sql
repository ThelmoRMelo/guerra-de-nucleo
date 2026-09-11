-- Cores são parte da identidade do participante: nunca devem ser improvisadas
-- (o comportamento anterior adicionava "#slot" e gerava cores inválidas).
CREATE OR REPLACE FUNCTION public.is_team_color(p_color text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_color = ANY (ARRAY[
    '#ff5470', '#3fb2ff', '#ffc93c', '#5ee6a8',
    '#c77dff', '#ff9f45', '#4dd0e1', '#f2f5ff'
  ]::text[]);
$$;

CREATE OR REPLACE FUNCTION public.create_room(
  p_code text, p_host_id uuid, p_name text, p_color text,
  p_bot_difficulty text, p_fill_with_bots boolean, p_core_restoration boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code);
BEGIN
  IF NOT public.is_team_color(p_color) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_color');
  END IF;
  IF EXISTS (SELECT 1 FROM rooms WHERE code = v_code) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'code_taken');
  END IF;
  INSERT INTO rooms (code, host_id, bot_difficulty, fill_with_bots, core_restoration)
  VALUES (v_code, p_host_id, p_bot_difficulty, p_fill_with_bots, p_core_restoration);
  INSERT INTO room_players (room_code, player_id, name, color, slot, is_host)
  VALUES (v_code, p_host_id, p_name, p_color, 0, true);
  RETURN jsonb_build_object('ok', true, 'code', v_code);
END; $$;

CREATE OR REPLACE FUNCTION public.join_room(
  p_code text, p_player_id uuid, p_name text, p_color text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := upper(p_code);
  v_room rooms%ROWTYPE;
  v_slot integer;
  v_existing_color text;
BEGIN
  IF NOT public.is_team_color(p_color) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_color');
  END IF;

  -- Serializa reservas na mesma sala, impedindo duas entradas simultâneas.
  SELECT * INTO v_room FROM rooms WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_room.status = 'closed' THEN RETURN jsonb_build_object('ok', false, 'error', 'closed'); END IF;
  IF v_room.status = 'started' THEN RETURN jsonb_build_object('ok', false, 'error', 'already_started'); END IF;

  SELECT color INTO v_existing_color
  FROM room_players WHERE room_code = v_code AND player_id = p_player_id;
  IF FOUND THEN
    UPDATE room_players SET connected = true, name = p_name
    WHERE room_code = v_code AND player_id = p_player_id;
    RETURN jsonb_build_object('ok', true, 'status', v_room.status, 'color', v_existing_color, 'rejoined', true);
  END IF;

  IF (SELECT count(*) FROM room_players WHERE room_code = v_code) >= v_room.max_players THEN
    RETURN jsonb_build_object('ok', false, 'error', 'full');
  END IF;
  IF EXISTS (SELECT 1 FROM room_players WHERE room_code = v_code AND color = p_color) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'color_taken');
  END IF;

  SELECT coalesce(max(slot) + 1, 0) INTO v_slot FROM room_players WHERE room_code = v_code;
  INSERT INTO room_players (room_code, player_id, name, color, slot, is_host)
  VALUES (v_code, p_player_id, p_name, p_color, v_slot, false);
  RETURN jsonb_build_object('ok', true, 'status', v_room.status, 'color', p_color);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'color_taken');
END; $$;

CREATE OR REPLACE FUNCTION public.update_room_player_color(
  p_code text, p_player_id uuid, p_color text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code); v_room rooms%ROWTYPE;
BEGIN
  IF NOT public.is_team_color(p_color) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_color');
  END IF;
  SELECT * INTO v_room FROM rooms WHERE code = v_code FOR UPDATE;
  IF NOT FOUND OR v_room.status <> 'lobby' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM room_players WHERE room_code = v_code AND player_id = p_player_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF EXISTS (SELECT 1 FROM room_players WHERE room_code = v_code AND color = p_color AND player_id <> p_player_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'color_taken');
  END IF;
  UPDATE room_players SET color = p_color, connected = true
  WHERE room_code = v_code AND player_id = p_player_id;
  RETURN jsonb_build_object('ok', true, 'color', p_color);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'color_taken');
END; $$;

CREATE OR REPLACE FUNCTION public.start_room_match(p_code text, p_host_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code); v_rows integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM room_players WHERE room_code = v_code
    GROUP BY room_code HAVING count(*) <> count(DISTINCT color)
       OR count(*) FILTER (WHERE NOT public.is_team_color(color)) > 0
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_player_colors');
  END IF;
  UPDATE rooms SET status = 'started', started_at = now(), updated_at = now()
  WHERE code = v_code AND host_id = p_host_id AND status = 'lobby';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started'); END IF;
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.is_team_color(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_room(text, uuid, text, text, text, boolean, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_room(text, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_room_player_color(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_room_match(text, uuid) TO anon, authenticated;
