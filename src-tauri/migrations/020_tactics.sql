CREATE TABLE IF NOT EXISTS team_tactics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    early_strategy TEXT NOT NULL DEFAULT 'standard',
    mid_strategy TEXT NOT NULL DEFAULT 'balanced',
    late_strategy TEXT NOT NULL DEFAULT 'teamfight',
    ward_priority TEXT NOT NULL DEFAULT 'balanced',
    dragon_priority INTEGER NOT NULL DEFAULT 5,
    baron_priority INTEGER NOT NULL DEFAULT 5,
    aggression_level INTEGER NOT NULL DEFAULT 5,
    UNIQUE(team_id)
);
