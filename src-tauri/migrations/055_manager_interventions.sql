CREATE TABLE IF NOT EXISTS manager_interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    intervention_type TEXT NOT NULL,
    topic TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    morale_bonus INTEGER NOT NULL DEFAULT 0,
    form_bonus INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manager_interventions_player_dates
ON manager_interventions(player_id, start_date, end_date);
