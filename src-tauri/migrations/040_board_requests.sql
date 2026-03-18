CREATE TABLE IF NOT EXISTS board_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    season_id INTEGER NOT NULL,
    request_type TEXT NOT NULL,
    request_amount INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    request_date TEXT NOT NULL,
    resolved_date TEXT,
    board_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_board_requests_team ON board_requests(team_id, season_id);
