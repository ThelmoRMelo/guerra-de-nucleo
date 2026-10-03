-- Pending authorization: apply as a NEW incremental migration, never modify old migrations.
DROP FUNCTION IF EXISTS public.update_room_player_color(text, text, text);

CREATE OR REPLACE FUNCTION public.update_room_player_color(p_code text, p_player_id uuid, p_color text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_code text := upper(p_code);
  v_room public.rooms%ROWTYPE;
  v_count integer;
  v_palette text[] := ARRAY['#ff5470', '#3fb2ff', '#ffc93c', '#5ee6a8', '#c77dff', '#ff9f45', '#4dd0e1', '#f2f5ff'];
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF v_room.status <> 'lobby' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.room_players WHERE room_code = v_code AND player_id = p_player_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_room.team_mode THEN v_palette := v_palette[1:4]; END IF;
  IF p_color IS NULL OR NOT (p_color = ANY(v_palette)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_color');
  END IF;
  SELECT count(*) INTO v_count FROM public.room_players
  WHERE room_code = v_code AND color = p_color AND player_id <> p_player_id;
  IF v_count >= CASE WHEN v_room.team_mode THEN 2 ELSE 1 END THEN
    RETURN jsonb_build_object('ok', false, 'error', 'color_taken');
  END IF;
  UPDATE public.room_players SET color = p_color, connected = true WHERE room_code = v_code AND player_id = p_player_id;
  RETURN jsonb_build_object('ok', true, 'color', p_color);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error', 'color_taken');
END; $$;

CREATE OR REPLACE FUNCTION public.start_room_match(p_code text, p_host_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_code text := upper(p_code);
  v_room public.rooms%ROWTYPE;
  v_palette text[] := ARRAY['#ff5470', '#3fb2ff', '#ffc93c', '#5ee6a8', '#c77dff', '#ff9f45', '#4dd0e1', '#f2f5ff'];
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF p_host_id IS NULL OR v_room.host_id IS DISTINCT FROM p_host_id OR v_room.status <> 'lobby' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started');
  END IF;
  IF v_room.team_mode THEN v_palette := v_palette[1:4]; END IF;
  IF EXISTS (
    SELECT 1 FROM public.room_players WHERE room_code = v_code AND (color IS NULL OR NOT (color = ANY(v_palette)))
  ) OR EXISTS (
    SELECT 1 FROM public.room_players WHERE room_code = v_code
    GROUP BY color HAVING count(*) > CASE WHEN v_room.team_mode THEN 2 ELSE 1 END
  ) THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_player_colors'); END IF;
  UPDATE public.rooms SET status = 'started', started_at = now(), updated_at = now() WHERE code = v_code;
  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE ALL ON FUNCTION public.update_room_player_color(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_room_match(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_room_player_color(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_room_match(text, uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';