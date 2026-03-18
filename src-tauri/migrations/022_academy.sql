CREATE TABLE IF NOT EXISTS academy_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    age INTEGER NOT NULL,
    potential INTEGER NOT NULL DEFAULT 70,
    mechanical INTEGER NOT NULL DEFAULT 30,
    game_sense INTEGER NOT NULL DEFAULT 30,
    teamwork INTEGER NOT NULL DEFAULT 30,
    consistency INTEGER NOT NULL DEFAULT 30,
    laning INTEGER NOT NULL DEFAULT 30,
    aggression INTEGER NOT NULL DEFAULT 30,
    training_progress INTEGER NOT NULL DEFAULT 0,
    promotion_ready INTEGER NOT NULL DEFAULT 0,
    joined_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rookie_draft_pool (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    age INTEGER NOT NULL DEFAULT 17,
    potential INTEGER NOT NULL,
    estimated_ability INTEGER NOT NULL,
    nationality TEXT NOT NULL DEFAULT 'KR',
    is_drafted INTEGER NOT NULL DEFAULT 0,
    drafted_by_team_id TEXT REFERENCES teams(id)
);

CREATE INDEX IF NOT EXISTS idx_academy_team ON academy_players(team_id);
CREATE INDEX IF NOT EXISTS idx_rookie_draft ON rookie_draft_pool(season_id, is_drafted);
