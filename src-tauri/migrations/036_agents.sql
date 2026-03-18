CREATE TABLE IF NOT EXISTS player_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    agent_name TEXT NOT NULL,
    greed_level INTEGER NOT NULL DEFAULT 5,    -- 1~10 (높을수록 요구 많음)
    loyalty_to_player INTEGER NOT NULL DEFAULT 7, -- 1~10
    UNIQUE(player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_agents_player ON player_agents(player_id);
