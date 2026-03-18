CREATE TABLE IF NOT EXISTS awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    award_type TEXT NOT NULL,
    player_id TEXT REFERENCES players(id),
    team_id TEXT REFERENCES teams(id),
    value REAL,
    awarded_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_awards_season ON awards(season_id);
CREATE INDEX IF NOT EXISTS idx_awards_player ON awards(player_id);
