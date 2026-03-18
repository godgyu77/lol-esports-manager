ALTER TABLE players ADD COLUMN is_retired INTEGER NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN retired_date TEXT;
ALTER TABLE players ADD COLUMN post_career TEXT; -- coach/analyst/streamer/none

CREATE TABLE IF NOT EXISTS retirement_hall (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    player_name TEXT NOT NULL,
    team_id TEXT,
    position TEXT NOT NULL,
    retired_date TEXT NOT NULL,
    career_seasons INTEGER NOT NULL DEFAULT 0,
    career_highlights TEXT,
    post_career TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
