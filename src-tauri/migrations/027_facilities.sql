CREATE TABLE IF NOT EXISTS team_facilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    facility_type TEXT NOT NULL,    -- gaming_house/training_room/analysis_lab/gym/media_room/cafeteria
    level INTEGER NOT NULL DEFAULT 1,   -- 1~5
    upgrade_cost INTEGER NOT NULL DEFAULT 0,
    effect_value REAL NOT NULL DEFAULT 0,
    last_upgraded TEXT,
    UNIQUE(team_id, facility_type)
);

CREATE TABLE IF NOT EXISTS facility_upgrades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    facility_type TEXT NOT NULL,
    from_level INTEGER NOT NULL,
    to_level INTEGER NOT NULL,
    cost INTEGER NOT NULL,
    upgrade_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facilities_team ON team_facilities(team_id);
