-- Mantém o contrato da RPC alinhado com room_players.player_id (uuid).
-- A migration anterior expôs p_player_id como text, o que causou falhas de
-- resolução da função pelo PostgREST em clientes que enviam o UUID do jogador.
DROP FUNCTION IF EXISTS public.update_room_player_color(text, text, text);

CREATE OR REPLACE FUNCTION public.update_room_player_color(
  p_code text,
  p_player_id uuid,
  p_color text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(p_code);
  v_room public.rooms%ROWTYPE;
  v_current_color text;
  v_color_count integer;
  v_capacity integer;
BEGIN
  IF p_color IS NULL OR NOT public.is_team_color(p_color) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_color');
  END IF;

  SELECT * INTO v_room
  FROM public.rooms
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_room.status = 'closed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'closed');
  END IF;
  IF v_room.status <> 'lobby' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_started');
  END IF;

  SELECT color INTO v_current_color
  FROM public.room_players
  WHERE room_code = v_code AND player_id = p_player_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_current_color = p_color THEN
    RETURN jsonb_build_object('ok', true, 'color', p_color);
  END IF;

  IF v_room.team_mode AND p_color <> ALL (
    ARRAY['#ff5470', '#3fb2ff', '#ffc93c', '#5ee6a8']::text[]
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_color');
  END IF;

  v_capacity := CASE WHEN v_room.team_mode THEN 2 ELSE 1 END;
  SELECT count(*) INTO v_color_count
  FROM public.room_players
  WHERE room_code = v_code AND color = p_color AND player_id <> p_player_id;

  IF v_color_count >= v_capacity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'color_taken');
  END IF;

  UPDATE public.room_players
  SET color = p_color, connected = true
  WHERE room_code = v_code AND player_id = p_player_id;

  RETURN jsonb_build_object('ok', true, 'color', p_color);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_room_player_color(text, uuid, text)
  TO anon, authenticated;

-- Serializa o início com alterações de cor e impede iniciar com combinações
-- que o motor não consegue representar no modo selecionado.
CREATE OR REPLACE FUNCTION public.start_room_match(p_code text, p_host_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(p_code);
  v_room public.rooms%ROWTYPE;
  v_rows integer;
BEGIN
  SELECT * INTO v_room
  FROM public.rooms
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_room.host_id <> p_host_id OR v_room.status <> 'lobby' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.room_players
    WHERE room_code = v_code
    GROUP BY color
    HAVING count(*) > CASE WHEN v_room.team_mode THEN 2 ELSE 1 END
  ) OR EXISTS (
    SELECT 1
    FROM public.room_players
    WHERE room_code = v_code
      AND (
        NOT public.is_team_color(color)
        OR (v_room.team_mode AND color <> ALL (
          ARRAY['#ff5470', '#3fb2ff', '#ffc93c', '#5ee6a8']::text[]
        ))
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_player_colors');
  END IF;

  UPDATE public.rooms
  SET status = 'started', started_at = now(), updated_at = now()
  WHERE code = v_code AND host_id = p_host_id AND status = 'lobby';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_room_match(text, uuid)
  TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
