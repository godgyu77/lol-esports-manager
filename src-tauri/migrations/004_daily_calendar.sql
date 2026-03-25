-- 시즌에 현재 날짜 추가
ALTER TABLE seasons ADD COLUMN current_date TEXT NOT NULL DEFAULT '2025-12-01';
ALTER TABLE seasons ADD COLUMN start_date TEXT NOT NULL DEFAULT '2025-12-01';
ALTER TABLE seasons ADD COLUMN end_date TEXT NOT NULL DEFAULT '2026-06-15';

-- 매치에 경기 날짜 추가
ALTER TABLE matches ADD COLUMN match_date TEXT;

-- 일간 이벤트 로그 테이블
CREATE TABLE IF NOT EXISTS daily_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    game_date TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN (
        'training', 'rest', 'match_day', 'scrim',
        'meeting', 'transfer', 'patch', 'injury', 'recovery',
        'event'
    )),
    target_id TEXT,          -- 관련 선수/팀 ID
    description TEXT,
    data TEXT,               -- JSON 추가 데이터
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 선수 일일 컨디션 테이블
CREATE TABLE IF NOT EXISTS player_daily_condition (
    player_id TEXT NOT NULL REFERENCES players(id),
    game_date TEXT NOT NULL,
    stamina INTEGER NOT NULL DEFAULT 80,
    morale INTEGER NOT NULL DEFAULT 70,
    form INTEGER NOT NULL DEFAULT 50,   -- 당일 폼 (0~100, 50=평균)
    PRIMARY KEY (player_id, game_date)
);
