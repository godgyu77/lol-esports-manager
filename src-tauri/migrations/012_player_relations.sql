-- 선수 간 친밀도 관계 테이블
CREATE TABLE IF NOT EXISTS player_relations (
    player_id TEXT NOT NULL REFERENCES players(id),
    target_player_id TEXT NOT NULL REFERENCES players(id),
    affinity INTEGER NOT NULL DEFAULT 50 CHECK(affinity >= 0 AND affinity <= 100),
    last_interaction_date TEXT,
    PRIMARY KEY (player_id, target_player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_relations_player ON player_relations(player_id);
