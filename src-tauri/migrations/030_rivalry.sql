CREATE TABLE IF NOT EXISTS coach_rivalries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_a_id TEXT NOT NULL REFERENCES teams(id),
    team_b_id TEXT NOT NULL REFERENCES teams(id),
    rivalry_level INTEGER NOT NULL DEFAULT 0,   -- -100(적대) ~ +100(우호)
    history TEXT,                                 -- 최근 대결 이력 요약
    last_match_date TEXT,
    UNIQUE(team_a_id, team_b_id)
);

CREATE TABLE IF NOT EXISTS pre_match_interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    team_id TEXT NOT NULL REFERENCES teams(id),
    interview_type TEXT NOT NULL,    -- respect/confident/provocative
    response_text TEXT NOT NULL,
    rivalry_change INTEGER NOT NULL DEFAULT 0,
    morale_change INTEGER NOT NULL DEFAULT 0,
    created_date TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rivalries ON coach_rivalries(team_a_id);
CREATE INDEX IF NOT EXISTS idx_interviews ON pre_match_interviews(match_id);
