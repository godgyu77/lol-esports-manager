-- 이적 제안 테이블
CREATE TABLE IF NOT EXISTS transfer_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    from_team_id TEXT NOT NULL REFERENCES teams(id),
    to_team_id TEXT REFERENCES teams(id),          -- NULL이면 자유계약 영입
    player_id TEXT NOT NULL REFERENCES players(id),
    transfer_fee INTEGER NOT NULL DEFAULT 0,        -- 이적료 (만 원)
    offered_salary INTEGER NOT NULL DEFAULT 0,      -- 제안 연봉 (만 원)
    contract_years INTEGER NOT NULL DEFAULT 2,      -- 계약 기간 (년)
    status TEXT NOT NULL DEFAULT 'pending',          -- 'pending' | 'accepted' | 'rejected' | 'cancelled'
    offer_date TEXT NOT NULL,
    resolved_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_offers_season ON transfer_offers(season_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_offers_player ON transfer_offers(player_id);
