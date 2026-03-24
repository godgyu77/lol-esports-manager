-- 커리어 통산 기록
CREATE TABLE IF NOT EXISTS player_career_stats (
  player_id TEXT PRIMARY KEY,
  team_id TEXT,
  total_games INTEGER DEFAULT 0,
  total_kills INTEGER DEFAULT 0,
  total_deaths INTEGER DEFAULT 0,
  total_assists INTEGER DEFAULT 0,
  total_cs INTEGER DEFAULT 0,
  total_damage INTEGER DEFAULT 0
);

-- 최근 폼 히스토리 (10경기 롤링)
CREATE TABLE IF NOT EXISTS player_form_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  game_date TEXT NOT NULL,
  form_score INTEGER NOT NULL DEFAULT 50
);
CREATE INDEX IF NOT EXISTS idx_form_history_player ON player_form_history(player_id);

-- 선수 간 케미스트리
CREATE TABLE IF NOT EXISTS player_chemistry (
  player_a_id TEXT NOT NULL,
  player_b_id TEXT NOT NULL,
  chemistry_score INTEGER NOT NULL DEFAULT 50,
  PRIMARY KEY (player_a_id, player_b_id)
);

-- 스태프 추가 컬럼 (philosophy, nationality)
-- ALTER TABLE 문은 이미 컬럼이 존재할 수 있어 IF NOT EXISTS 불가하므로 무시 가능
-- 이 마이그레이션은 Tauri SQL 플러그인이 자동 실행

-- 시설 컨디션 컬럼
-- ALTER TABLE team_facilities ADD COLUMN condition INTEGER DEFAULT 100;
