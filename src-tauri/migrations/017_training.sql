-- 훈련 스케줄 (팀별 주간 훈련 계획)
CREATE TABLE IF NOT EXISTS training_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    day_of_week INTEGER NOT NULL,              -- 0(일)~6(토), 경기일 제외
    training_type TEXT NOT NULL DEFAULT 'general', -- general/laning/teamfight/macro/champion_pool/mental/physical
    intensity TEXT NOT NULL DEFAULT 'normal',   -- light/normal/intense
    UNIQUE(team_id, day_of_week)
);

-- 선수 개별 훈련 배정
CREATE TABLE IF NOT EXISTS player_training (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    training_type TEXT NOT NULL DEFAULT 'general',
    target_stat TEXT,                           -- mechanical/gameSense/teamwork/consistency/laning/aggression
    target_champion_id TEXT,                    -- 챔피언 풀 확장 시
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(player_id)
);

-- 훈련 이력 (일별 기록)
CREATE TABLE IF NOT EXISTS training_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    training_date TEXT NOT NULL,
    training_type TEXT NOT NULL,
    stat_changed TEXT,                          -- 변화된 스탯 이름
    stat_delta REAL NOT NULL DEFAULT 0,         -- 변화량
    champion_id TEXT,                           -- 챔피언 숙련도 변화 시
    champion_delta REAL NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_training_schedule_team ON training_schedule(team_id);
CREATE INDEX IF NOT EXISTS idx_player_training_team ON player_training(team_id);
CREATE INDEX IF NOT EXISTS idx_training_logs_player ON training_logs(player_id, training_date);
