-- 팀 테이블
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    region TEXT NOT NULL,
    budget INTEGER NOT NULL DEFAULT 0,
    salary_cap INTEGER NOT NULL DEFAULT 0,
    reputation INTEGER NOT NULL DEFAULT 50,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 선수 테이블
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    team_id TEXT REFERENCES teams(id),
    position TEXT NOT NULL CHECK(position IN ('top', 'jungle', 'mid', 'adc', 'support')),
    age INTEGER NOT NULL,
    nationality TEXT NOT NULL,

    -- 핵심 스탯 (0-100)
    mechanical INTEGER NOT NULL DEFAULT 50,
    game_sense INTEGER NOT NULL DEFAULT 50,
    teamwork INTEGER NOT NULL DEFAULT 50,
    consistency INTEGER NOT NULL DEFAULT 50,
    laning INTEGER NOT NULL DEFAULT 50,
    aggression INTEGER NOT NULL DEFAULT 50,

    -- 멘탈/컨디션
    mental INTEGER NOT NULL DEFAULT 70,
    stamina INTEGER NOT NULL DEFAULT 80,
    morale INTEGER NOT NULL DEFAULT 70,

    -- 계약
    salary INTEGER NOT NULL DEFAULT 0,
    contract_end_season INTEGER NOT NULL DEFAULT 1,

    -- 성장/노화
    potential INTEGER NOT NULL DEFAULT 50,
    peak_age INTEGER NOT NULL DEFAULT 22,

    -- 인기도
    popularity INTEGER NOT NULL DEFAULT 10,

    is_user_player BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 챔피언 숙련도 테이블
CREATE TABLE IF NOT EXISTS champion_proficiency (
    player_id TEXT NOT NULL REFERENCES players(id),
    champion_id TEXT NOT NULL,
    proficiency INTEGER NOT NULL DEFAULT 50,
    games_played INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, champion_id)
);

-- 시즌 테이블
CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    split TEXT NOT NULL CHECK(split IN ('spring', 'summer')),
    current_week INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 매치 테이블
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    week INTEGER NOT NULL,
    team_home_id TEXT NOT NULL REFERENCES teams(id),
    team_away_id TEXT NOT NULL REFERENCES teams(id),
    score_home INTEGER DEFAULT 0,
    score_away INTEGER DEFAULT 0,
    is_played BOOLEAN NOT NULL DEFAULT FALSE,
    played_at DATETIME
);

-- 게임(세트) 테이블
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL REFERENCES matches(id),
    game_number INTEGER NOT NULL,
    winner_team_id TEXT REFERENCES teams(id),
    duration_seconds INTEGER,
    gold_diff_at_15 INTEGER DEFAULT 0,
    total_kills_home INTEGER DEFAULT 0,
    total_kills_away INTEGER DEFAULT 0
);

-- 세이브 메타데이터
CREATE TABLE IF NOT EXISTS save_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL CHECK(mode IN ('manager', 'player')),
    user_team_id TEXT NOT NULL REFERENCES teams(id),
    user_player_id TEXT REFERENCES players(id),
    current_season_id INTEGER REFERENCES seasons(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
