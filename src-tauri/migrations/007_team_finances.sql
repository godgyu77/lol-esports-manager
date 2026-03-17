CREATE TABLE IF NOT EXISTS team_finance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    game_date TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'income' | 'expense'
    category TEXT NOT NULL,  -- 'salary', 'prize', 'sponsorship', 'transfer', etc.
    amount INTEGER NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_finance_team_season ON team_finance_log(team_id, season_id);
