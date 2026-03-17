-- 선수 특성 테이블
CREATE TABLE IF NOT EXISTS player_traits (
    player_id TEXT NOT NULL REFERENCES players(id),
    trait_id TEXT NOT NULL,
    PRIMARY KEY (player_id, trait_id)
);

-- 특성 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_player_traits_player ON player_traits(player_id);
