-- Estado visual de cada humano em uma partida. O servidor é a fonte de
-- sincronização para posição/direção, sem expor escrita direta pela API.
CREATE TABLE public.room_player_states (
  room_code text NOT NULL REFERENCES public.rooms(code) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  pos_x double precision NOT NULL,
  pos_y double precision NOT NULL,
  pos_z double precision NOT NULL,
  yaw double precision NOT NULL,
  moving boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_code, player_id),
  FOREIGN KEY (room_code, player_id)
    REFERENCES public.room_players(room_code, player_id) ON DELETE CASCADE
);

CREATE INDEX room_player_states_room_idx ON public.room_player_states (room_code);

GRANT SELECT ON public.room_player_states TO anon, authenticated;
GRANT ALL ON public.room_player_states TO service_role;

ALTER TABLE public.room_player_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Estados de partida visíveis para participantes" ON public.room_player_states
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_room_player_state(
  p_code text, p_player_id uuid,
  p_pos_x double precision, p_pos_y double precision, p_pos_z double precision,
  p_yaw double precision, p_moving boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text := upper(p_code);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM rooms WHERE code = v_code AND status = 'started') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_started');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM room_players WHERE room_code = v_code AND player_id = p_player_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF p_pos_x NOT BETWEEN -250 AND 250 OR p_pos_y NOT BETWEEN -50 AND 100
     OR p_pos_z NOT BETWEEN -250 AND 250 OR p_yaw NOT BETWEEN -7 AND 7 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  INSERT INTO room_player_states (room_code, player_id, pos_x, pos_y, pos_z, yaw, moving, updated_at)
  VALUES (v_code, p_player_id, p_pos_x, p_pos_y, p_pos_z, p_yaw, p_moving, now())
  ON CONFLICT (room_code, player_id) DO UPDATE SET
    pos_x = EXCLUDED.pos_x,
    pos_y = EXCLUDED.pos_y,
    pos_z = EXCLUDED.pos_z,
    yaw = EXCLUDED.yaw,
    moving = EXCLUDED.moving,
    updated_at = EXCLUDED.updated_at;
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.update_room_player_state(
  text, uuid, double precision, double precision, double precision, double precision, boolean
) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.room_player_states;
ALTER TABLE public.room_player_states REPLICA IDENTITY FULL;
