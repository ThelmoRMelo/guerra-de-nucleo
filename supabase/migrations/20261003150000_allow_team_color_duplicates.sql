-- Permite que dois jogadores usem a mesma cor no modo equipe.
-- A regra de quantidade (máx. 2 no modo equipe / 1 no individual)
-- já é controlada pela função update_room_player_color.

ALTER TABLE public.room_players
  DROP CONSTRAINT IF EXISTS room_players_room_code_color_key;
