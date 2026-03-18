CREATE TABLE IF NOT EXISTS hall_of_fame (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    record_type TEXT NOT NULL,     -- champion/mvp/all_pro/most_kills/most_wins/longest_streak
    player_id TEXT REFERENCES players(id),
    team_id TEXT REFERENCES teams(id),
    value REAL,
    description TEXT,
    recorded_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS season_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    final_standing INTEGER,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    playoff_result TEXT,
    champion INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hof_type ON hall_of_fame(record_type);
CREATE INDEX IF NOT EXISTS idx_season_records_team ON season_records(team_id);
