-- 046: LoL E스포츠 특화 시스템 추가
-- 솔로랭크, 패치 메타 보정, 드래곤 소울, 보이드 그럽

-- 선수 솔로랭크 상태
CREATE TABLE IF NOT EXISTS player_solo_rank (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'master',          -- challenger/grandmaster/master/diamond/emerald/platinum
  lp INTEGER NOT NULL DEFAULT 500,              -- League Points (0~1500)
  recent_win_rate REAL NOT NULL DEFAULT 0.5,    -- 최근 20게임 승률
  practice_champion_id TEXT,                     -- 연습 중인 챔피언 ID
  rank_position INTEGER NOT NULL DEFAULT 100,   -- 지역 내 순위
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 솔로랭크 일간 기록
CREATE TABLE IF NOT EXISTS solo_rank_daily_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_date TEXT NOT NULL,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  lp_change INTEGER NOT NULL DEFAULT 0,
  tier_changed INTEGER NOT NULL DEFAULT 0,
  new_tier TEXT,
  practice_champion_id TEXT,
  proficiency_gain INTEGER DEFAULT 0,
  UNIQUE(player_id, game_date)
);

-- 패치 메타 전략 효율 보정
CREATE TABLE IF NOT EXISTS patch_meta_modifiers (
  season_id INTEGER NOT NULL,
  patch_number INTEGER NOT NULL,
  teamfight_efficiency REAL NOT NULL DEFAULT 0,     -- 한타 전략 효율 (-0.1 ~ +0.1)
  split_push_efficiency REAL NOT NULL DEFAULT 0,    -- 스플릿 전략 효율
  early_aggro_efficiency REAL NOT NULL DEFAULT 0,   -- 초반 어그로 효율
  objective_efficiency REAL NOT NULL DEFAULT 0,     -- 오브젝트 컨트롤 효율
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (season_id, patch_number)
);

-- 스크림 테스트 데이터 확장 (기존 scrim_results에 컬럼 추가)
-- tested_strategy: 테스트한 전술
-- tested_champions: 테스트한 챔피언 (JSON 배열)
-- laning_feedback: 라인전 피드백 점수
-- teamfight_feedback: 팀파이트 피드백 점수
ALTER TABLE scrim_results ADD COLUMN tested_strategy TEXT;
ALTER TABLE scrim_results ADD COLUMN tested_champions TEXT; -- JSON array
ALTER TABLE scrim_results ADD COLUMN laning_feedback INTEGER DEFAULT 0;
ALTER TABLE scrim_results ADD COLUMN teamfight_feedback INTEGER DEFAULT 0;
ALTER TABLE scrim_results ADD COLUMN objective_feedback INTEGER DEFAULT 0;
