CREATE TABLE IF NOT EXISTS player_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    season_id INTEGER NOT NULL,
    goal_type TEXT NOT NULL,      -- mvp_candidate/all_pro/international/starter/improve_stat
    target_value TEXT,             -- 목표 수치 (예: 'mechanical:80')
    is_achieved INTEGER NOT NULL DEFAULT 0,
    reward_morale INTEGER NOT NULL DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
