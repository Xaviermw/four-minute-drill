-- Game clock (seconds) left when the player scored -- shown on the board.
alter table public.scores add column time_remaining int not null default 0;
