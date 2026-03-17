-- 스폰서 계약 테이블
CREATE TABLE IF NOT EXISTS sponsors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    name TEXT NOT NULL,
    tier TEXT NOT NULL,            -- 'platinum' | 'gold' | 'silver' | 'bronze'
    weekly_payout INTEGER NOT NULL, -- 주간 수입 (만 원)
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'expired' | 'cancelled'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sponsors_team_season ON sponsors(team_id, season_id);
CREATE INDEX IF NOT EXISTS idx_sponsors_status ON sponsors(status);
