-- Permite que uma cor represente uma equipe, com a capacidade controlada
-- pelas RPCs (que serializam alterações bloqueando a linha da sala).
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS team_mode boolean NOT NULL DEFAULT false;

ALTER TABLE public.room_players
  DROP CONSTRAINT IF EXISTS room_players_room_code_color_key;

-- Remover as assinaturas antigas para evitar sobrecarga ambígua no PostgREST.
DROP FUNCTION IF EXISTS public.update_room_player_color(text, uuid, text);
DROP FUNCTION IF EXISTS public.update_room_player_color(text, text, text);
DROP FUNCTION IF EXISTS public.update_room_settings(text, uuid, text, boolean, boolean);
DROP FUNCTION IF EXISTS public.update_room_settings(text, uuid, text, boolean, boolean, boolean);

CREATE FUNCTION public.update_room_player_color(
  p_code text,
  p_player_id text,
  p_color text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(p_code);
  v_player_id uuid;
  v_room public.rooms%ROWTYPE;
  v_current_color text;
  v_color_count integer;
  v_capacity integer;
BEGIN
  IF p_color IS NULL OR NOT public.is_team_color(p_color) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_color');
  END IF;

  BEGIN
    v_player_id := p_player_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END;

  -- O bloqueio serializa trocas simultâneas dentro da mesma sala.
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
  WHERE room_code = v_code AND player_id = v_player_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Uma tentativa de manter a cor atual é sucesso, inclusive se a equipe estiver cheia.
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
  WHERE room_code = v_code AND color = p_color AND player_id <> v_player_id;

  IF v_color_count >= v_capacity THEN
    RETURN jsonb_build_object('ok', false, 'error', 'color_taken');
  END IF;

  UPDATE public.room_players
  SET color = p_color, connected = true
  WHERE room_code = v_code AND player_id = v_player_id;

  RETURN jsonb_build_object('ok', true, 'color', p_color);
END;
$$;

CREATE FUNCTION public.update_room_settings(
  p_code text,
  p_host_id uuid,
  p_bot_difficulty text,
  p_fill_with_bots boolean,
  p_core_restoration boolean,
  p_team_mode boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(p_code);
  v_room public.rooms%ROWTYPE;
BEGIN
  SELECT * INTO v_room
  FROM public.rooms
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_room.host_id <> p_host_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_host_or_started');
  END IF;
  IF v_room.status <> 'lobby' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_started');
  END IF;

  -- Ao mudar de Equipes para Individual, os jogadores precisam escolher
  -- cores individuais no lobby; start_room_match já bloqueia iniciar até
  -- que não haja cores duplicadas.
  IF p_team_mode AND (EXISTS (
    SELECT 1
    FROM public.room_players
    WHERE room_code = v_code
    GROUP BY color
    HAVING count(*) > 2
  ) OR EXISTS (
    SELECT 1
    FROM public.room_players
    WHERE room_code = v_code
      AND (
        NOT public.is_team_color(color)
        OR color <> ALL (
          ARRAY['#ff5470', '#3fb2ff', '#ffc93c', '#5ee6a8']::text[]
        )
      )
  )) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_player_colors');
  END IF;

  UPDATE public.rooms
  SET bot_difficulty = p_bot_difficulty,
      fill_with_bots = p_fill_with_bots,
      core_restoration = p_core_restoration,
      team_mode = p_team_mode,
      updated_at = now()
  WHERE code = v_code;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_room_player_color(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_room_settings(text, uuid, text, boolean, boolean, boolean) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
