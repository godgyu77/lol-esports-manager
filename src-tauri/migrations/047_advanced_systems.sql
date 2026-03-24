-- 047: 고급 시스템 — 감독 커리어, 선수 만족도, 상대 분석

-- 감독 커리어 기록
CREATE TABLE IF NOT EXISTS manager_career (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id INTEGER NOT NULL,
  season_id INTEGER NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  year INTEGER NOT NULL,
  split TEXT NOT NULL,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  standing INTEGER,
  playoff_result TEXT,
  trophies TEXT,          -- JSON array
  was_fired INTEGER DEFAULT 0,
  UNIQUE(save_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_manager_career_save ON manager_career(save_id);

-- 선수 만족도 추적
CREATE TABLE IF NOT EXISTS player_satisfaction (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  overall_satisfaction INTEGER DEFAULT 50,
  playtime_satisfaction INTEGER DEFAULT 50,
  salary_satisfaction INTEGER DEFAULT 50,
  team_performance_satisfaction INTEGER DEFAULT 50,
  personal_performance_satisfaction INTEGER DEFAULT 50,
  role_clarity INTEGER DEFAULT 50,
  team_chemistry_satisfaction INTEGER DEFAULT 50,
  last_updated TEXT DEFAULT (datetime('now'))
);

-- 상대팀 패턴 분석
CREATE TABLE IF NOT EXISTS opponent_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL,
  opponent_team_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  most_picked_champions TEXT,     -- JSON
  avg_game_duration REAL,
  first_blood_rate REAL,
  early_aggro_tendency REAL,
  weak_positions TEXT,            -- JSON array
  last_updated TEXT DEFAULT (datetime('now')),
  UNIQUE(team_id, opponent_team_id, season_id)
);

CREATE INDEX IF NOT EXISTS idx_opponent_patterns_team ON opponent_patterns(team_id, season_id);
