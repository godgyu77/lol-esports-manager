CREATE TABLE IF NOT EXISTS contract_clauses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    clause_type TEXT NOT NULL,       -- appearance_bonus/performance_bonus/relegation_release/loyalty_bonus
    clause_value INTEGER NOT NULL,
    condition_text TEXT,
    is_triggered INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
