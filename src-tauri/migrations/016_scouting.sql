-- 스카우트 테이블
CREATE TABLE IF NOT EXISTS scouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    name TEXT NOT NULL,
    ability INTEGER NOT NULL DEFAULT 50,        -- 스카우팅 능력 (0-100)
    experience INTEGER NOT NULL DEFAULT 0,      -- 경험치 (리포트 제출 수)
    region_specialty TEXT DEFAULT NULL,          -- 특화 리전 (LCK/LPL/LEC/LCS)
    salary INTEGER NOT NULL DEFAULT 500,        -- 연봉 (만 원)
    hired_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 스카우팅 리포트 테이블
CREATE TABLE IF NOT EXISTS scouting_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scout_id INTEGER NOT NULL REFERENCES scouts(id),
    player_id TEXT NOT NULL REFERENCES players(id),
    team_id TEXT NOT NULL REFERENCES teams(id),       -- 리포트 소유 팀
    accuracy INTEGER NOT NULL DEFAULT 50,              -- 리포트 정확도 (0-100)
    reported_mechanical INTEGER,
    reported_game_sense INTEGER,
    reported_teamwork INTEGER,
    reported_consistency INTEGER,
    reported_laning INTEGER,
    reported_aggression INTEGER,
    reported_potential INTEGER,
    reported_mental INTEGER,
    overall_grade TEXT NOT NULL DEFAULT 'C',            -- S/A/B/C/D 등급 평가
    scout_comment TEXT,                                 -- 스카우트 코멘트
    report_date TEXT NOT NULL,
    is_completed INTEGER NOT NULL DEFAULT 0,           -- 0: 진행중, 1: 완료
    days_remaining INTEGER NOT NULL DEFAULT 3,          -- 완료까지 남은 일수
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 스카우팅 관심 목록
CREATE TABLE IF NOT EXISTS scouting_watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    player_id TEXT NOT NULL REFERENCES players(id),
    added_date TEXT NOT NULL,
    notes TEXT,
    UNIQUE(team_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_scouts_team ON scouts(team_id);
CREATE INDEX IF NOT EXISTS idx_scouting_reports_team ON scouting_reports(team_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_scouting_reports_player ON scouting_reports(player_id);
CREATE INDEX IF NOT EXISTS idx_scouting_watchlist_team ON scouting_watchlist(team_id);
