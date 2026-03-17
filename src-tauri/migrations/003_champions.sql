-- 챔피언 마스터 테이블
CREATE TABLE IF NOT EXISTS champions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ko TEXT NOT NULL,
    primary_role TEXT NOT NULL CHECK(primary_role IN ('top','jungle','mid','adc','support')),
    secondary_roles TEXT NOT NULL DEFAULT '[]', -- JSON 배열: ["mid","top"]
    tier TEXT NOT NULL DEFAULT 'B' CHECK(tier IN ('S','A','B','C','D')),
    tags TEXT NOT NULL DEFAULT '[]',            -- JSON 배열: ["mage","assassin"]
    early_game INTEGER NOT NULL DEFAULT 50,
    late_game INTEGER NOT NULL DEFAULT 50,
    teamfight INTEGER NOT NULL DEFAULT 50,
    split_push INTEGER NOT NULL DEFAULT 50,
    difficulty INTEGER NOT NULL DEFAULT 50
);

-- 패치 수정자 테이블 (AI 밸런스 패치용)
CREATE TABLE IF NOT EXISTS champion_patches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    week INTEGER NOT NULL,
    champion_id TEXT NOT NULL REFERENCES champions(id),
    stat_key TEXT NOT NULL CHECK(stat_key IN ('early_game','late_game','teamfight','split_push','tier')),
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    reason TEXT,                     -- 패치 사유 (AI 생성)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 패치 적용 후 현재 챔피언 스탯 오버라이드
CREATE TABLE IF NOT EXISTS champion_stat_modifiers (
    champion_id TEXT NOT NULL REFERENCES champions(id),
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    early_game_mod INTEGER NOT NULL DEFAULT 0,
    late_game_mod INTEGER NOT NULL DEFAULT 0,
    teamfight_mod INTEGER NOT NULL DEFAULT 0,
    split_push_mod INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (champion_id, season_id)
);
