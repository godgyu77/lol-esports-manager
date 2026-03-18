CREATE TABLE IF NOT EXISTS player_complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    complaint_type TEXT NOT NULL,   -- playtime/salary/transfer/role/morale
    severity INTEGER NOT NULL DEFAULT 1,  -- 1(경미)~3(심각)
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active/resolved/ignored/escalated
    created_date TEXT NOT NULL,
    resolved_date TEXT,
    resolution TEXT,
    morale_impact INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_complaints_team ON player_complaints(team_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_player ON player_complaints(player_id);
