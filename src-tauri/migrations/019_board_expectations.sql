CREATE TABLE IF NOT EXISTS board_expectations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    target_standing INTEGER NOT NULL DEFAULT 4,
    target_playoff INTEGER NOT NULL DEFAULT 0,
    target_international INTEGER NOT NULL DEFAULT 0,
    satisfaction INTEGER NOT NULL DEFAULT 50,
    fan_happiness INTEGER NOT NULL DEFAULT 50,
    warning_count INTEGER NOT NULL DEFAULT 0,
    is_fired INTEGER NOT NULL DEFAULT 0,
    UNIQUE(team_id, season_id)
);

CREATE TABLE IF NOT EXISTS fan_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    reaction_date TEXT NOT NULL,
    event_type TEXT NOT NULL,
    happiness_change INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_board_expectations_team ON board_expectations(team_id, season_id);
CREATE INDEX IF NOT EXISTS idx_fan_reactions_team ON fan_reactions(team_id);
