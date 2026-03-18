CREATE TABLE IF NOT EXISTS player_injuries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    injury_type TEXT NOT NULL,         -- wrist/back/eye/mental_burnout/minor
    severity INTEGER NOT NULL DEFAULT 1, -- 1(경미)~3(심각)
    days_remaining INTEGER NOT NULL,
    occurred_date TEXT NOT NULL,
    expected_return TEXT NOT NULL,
    is_recovered INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_injuries_player ON player_injuries(player_id, is_recovered);
CREATE INDEX IF NOT EXISTS idx_injuries_team ON player_injuries(team_id, is_recovered);
