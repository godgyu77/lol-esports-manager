CREATE TABLE IF NOT EXISTS team_talks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    team_id TEXT NOT NULL REFERENCES teams(id),
    talk_type TEXT NOT NULL,
    talk_tone TEXT NOT NULL,
    target_player_id TEXT,
    morale_change INTEGER NOT NULL DEFAULT 0,
    form_change INTEGER NOT NULL DEFAULT 0,
    created_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_team_talks_match ON team_talks(match_id, team_id);
