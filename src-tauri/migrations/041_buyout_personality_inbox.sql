-- 위약금 조항
ALTER TABLE players ADD COLUMN buyout_clause INTEGER NOT NULL DEFAULT 0;

-- 선수 성격
CREATE TABLE IF NOT EXISTS player_personality (
    player_id TEXT PRIMARY KEY REFERENCES players(id),
    ambition INTEGER NOT NULL DEFAULT 5,
    loyalty INTEGER NOT NULL DEFAULT 5,
    professionalism INTEGER NOT NULL DEFAULT 5,
    temperament INTEGER NOT NULL DEFAULT 5,
    determination INTEGER NOT NULL DEFAULT 5
);

-- 받은 편지함
CREATE TABLE IF NOT EXISTS inbox_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    action_required INTEGER NOT NULL DEFAULT 0,
    action_route TEXT,
    related_id TEXT,
    created_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inbox_team ON inbox_messages(team_id, is_read);

-- 상대팀 분석
CREATE TABLE IF NOT EXISTS match_analysis_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    opponent_team_id TEXT NOT NULL REFERENCES teams(id),
    accuracy INTEGER NOT NULL DEFAULT 50,
    recent_wins INTEGER NOT NULL DEFAULT 0,
    recent_losses INTEGER NOT NULL DEFAULT 0,
    play_style TEXT,
    key_player_id TEXT,
    weak_position TEXT,
    recommended_bans TEXT,
    generated_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 스크림 결과
CREATE TABLE IF NOT EXISTS scrim_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    opponent_team_id TEXT NOT NULL REFERENCES teams(id),
    scrim_date TEXT NOT NULL,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    mvp_player_id TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_scrims_team ON scrim_results(team_id, scrim_date);
