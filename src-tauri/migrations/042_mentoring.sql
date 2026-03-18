CREATE TABLE IF NOT EXISTS player_mentoring (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mentor_id TEXT NOT NULL REFERENCES players(id),
    mentee_id TEXT NOT NULL REFERENCES players(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    start_date TEXT NOT NULL,
    bonus_stat TEXT,
    daily_growth_bonus REAL NOT NULL DEFAULT 0.05,
    is_active INTEGER NOT NULL DEFAULT 1,
    UNIQUE(mentee_id)
);
