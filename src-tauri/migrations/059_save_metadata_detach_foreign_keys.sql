CREATE TABLE IF NOT EXISTS save_metadata_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL CHECK(mode IN ('manager', 'player')),
    user_team_id TEXT NOT NULL,
    user_player_id TEXT,
    current_season_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    slot_number INTEGER NOT NULL DEFAULT 1,
    save_name TEXT NOT NULL DEFAULT '자동 저장',
    play_time_minutes INTEGER NOT NULL DEFAULT 0,
    team_name TEXT,
    season_info TEXT,
    rng_seed TEXT,
    db_filename TEXT NOT NULL DEFAULT 'autosave.db',
    game_save_id INTEGER NOT NULL DEFAULT 1
);

INSERT INTO save_metadata_new (
    id,
    mode,
    user_team_id,
    user_player_id,
    current_season_id,
    created_at,
    updated_at,
    slot_number,
    save_name,
    play_time_minutes,
    team_name,
    season_info,
    rng_seed,
    db_filename,
    game_save_id
)
SELECT
    id,
    mode,
    user_team_id,
    user_player_id,
    current_season_id,
    created_at,
    updated_at,
    slot_number,
    save_name,
    play_time_minutes,
    team_name,
    season_info,
    rng_seed,
    db_filename,
    game_save_id
FROM save_metadata;

DROP TABLE save_metadata;
ALTER TABLE save_metadata_new RENAME TO save_metadata;

CREATE UNIQUE INDEX IF NOT EXISTS idx_save_metadata_slot_number ON save_metadata(slot_number);
CREATE INDEX IF NOT EXISTS idx_save_metadata_game_save_id ON save_metadata(game_save_id);
