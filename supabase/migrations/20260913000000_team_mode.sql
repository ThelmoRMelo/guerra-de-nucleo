-- Equipes de duas pessoas: cores podem se repetir somente em pares.
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS team_mode boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.update_room_settings(
  p_code text, p_host_id uuid, p_bot_difficulty text, p_fill_with_bots boolean,
  p_core_restoration boolean, p_team_mode boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE code = v_code AND host_id = p_host_id AND status = 'lobby') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started');
  END IF;
  IF p_team_mode AND EXISTS (
    SELECT 1 FROM room_players WHERE room_code = v_code GROUP BY color HAVING count(*) > 2
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_player_colors');
  END IF;
  IF p_team_mode AND EXISTS (
    SELECT 1 FROM room_players WHERE room_code = v_code
    AND color <> ALL (ARRAY['#ff5470', '#3fb2ff', '#ffc93c', '#5ee6a8'])
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_player_colors'); END IF;
  UPDATE rooms SET bot_difficulty = p_bot_difficulty, fill_with_bots = p_fill_with_bots,
    core_restoration = p_core_restoration, team_mode = p_team_mode,
    max_players = 8, updated_at = now()
  WHERE code = v_code;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.join_room(
  p_code text, p_player_id uuid, p_name text, p_color text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code); v_room rooms%ROWTYPE; v_slot integer; v_color_count integer;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_room.status = 'closed' THEN RETURN jsonb_build_object('ok', false, 'error', 'closed'); END IF;
  IF v_room.status <> 'lobby' THEN RETURN jsonb_build_object('ok', false, 'error', 'already_started'); END IF;
  IF EXISTS (SELECT 1 FROM room_players WHERE room_code = v_code AND player_id = p_player_id) THEN
    UPDATE room_players SET connected = true, name = p_name WHERE room_code = v_code AND player_id = p_player_id;
    RETURN jsonb_build_object('ok', true, 'color', (SELECT color FROM room_players WHERE room_code = v_code AND player_id = p_player_id));
  END IF;
  IF (SELECT count(*) FROM room_players WHERE room_code = v_code) >= v_room.max_players THEN RETURN jsonb_build_object('ok', false, 'error', 'full'); END IF;
  SELECT count(*) INTO v_color_count FROM room_players WHERE room_code = v_code AND color = p_color;
  IF v_room.team_mode AND p_color <> ALL (ARRAY['#ff5470', '#3fb2ff', '#ffc93c', '#5ee6a8']) THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_color'); END IF;
  IF v_color_count >= CASE WHEN v_room.team_mode THEN 2 ELSE 1 END THEN RETURN jsonb_build_object('ok', false, 'error', 'color_taken'); END IF;
  SELECT coalesce(max(slot) + 1, 0) INTO v_slot FROM room_players WHERE room_code = v_code;
  INSERT INTO room_players (room_code, player_id, name, color, slot, is_host) VALUES (v_code, p_player_id, p_name, p_color, v_slot, false);
  RETURN jsonb_build_object('ok', true, 'color', p_color);
END $$;

CREATE OR REPLACE FUNCTION public.update_room_player_color(p_code text, p_player_id uuid, p_color text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code); v_room rooms%ROWTYPE; v_count integer;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = v_code FOR UPDATE;
  IF NOT FOUND OR v_room.status <> 'lobby' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started'); END IF;
  SELECT count(*) INTO v_count FROM room_players WHERE room_code = v_code AND color = p_color AND player_id <> p_player_id;
  IF v_room.team_mode AND p_color <> ALL (ARRAY['#ff5470', '#3fb2ff', '#ffc93c', '#5ee6a8']) THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_color'); END IF;
  IF v_count >= CASE WHEN v_room.team_mode THEN 2 ELSE 1 END THEN RETURN jsonb_build_object('ok', false, 'error', 'color_taken'); END IF;
  UPDATE room_players SET color = p_color, connected = true WHERE room_code = v_code AND player_id = p_player_id;
  RETURN jsonb_build_object('ok', true, 'color', p_color);
END $$;

GRANT EXECUTE ON FUNCTION public.update_room_settings(text, uuid, text, boolean, boolean, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_room_match(p_code text, p_host_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code); v_room rooms%ROWTYPE; v_rows integer;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = v_code;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF EXISTS (
    SELECT 1 FROM room_players WHERE room_code = v_code GROUP BY color
    HAVING count(*) > CASE WHEN v_room.team_mode THEN 2 ELSE 1 END
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_player_colors'); END IF;
  UPDATE rooms SET status = 'started', started_at = now(), updated_at = now()
  WHERE code = v_code AND host_id = p_host_id AND status = 'lobby';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started'); END IF;
  RETURN jsonb_build_object('ok', true);
END $$;
