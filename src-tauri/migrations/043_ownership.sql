CREATE TABLE IF NOT EXISTS club_ownership (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    owner_name TEXT NOT NULL,
    investment_level TEXT NOT NULL DEFAULT 'moderate',  -- low/moderate/high/sugar_daddy
    patience INTEGER NOT NULL DEFAULT 5,                -- 1~10
    ambition INTEGER NOT NULL DEFAULT 5,                -- 1~10
    is_active INTEGER NOT NULL DEFAULT 1,
    start_date TEXT NOT NULL
);
