CREATE TABLE IF NOT EXISTS manager_promises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    promise_type TEXT NOT NULL,
    promise_date TEXT NOT NULL,
    deadline_date TEXT NOT NULL,
    is_fulfilled INTEGER NOT NULL DEFAULT 0,
    is_broken INTEGER NOT NULL DEFAULT 0,
    trust_penalty INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_promises_player ON manager_promises(player_id, is_fulfilled, is_broken);
