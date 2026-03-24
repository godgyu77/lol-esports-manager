-- 누락된 테이블 추가 (코드에서 참조하지만 마이그레이션에 없던 테이블들)

-- 선수 수상 기록 (retirementEngine, awardEngine 참조)
CREATE TABLE IF NOT EXISTS player_awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id),
    season_id INTEGER NOT NULL,
    award_type TEXT NOT NULL,  -- 'champion', 'mvp', 'worlds_champion', 'rookie', 'all_pro' 등
    awarded_date TEXT NOT NULL,
    UNIQUE(player_id, season_id, award_type)
);
CREATE INDEX IF NOT EXISTS idx_player_awards_player ON player_awards(player_id);

-- 시즌 순위 캐시 (achievementEngine, promiseEngine 참조)
CREATE TABLE IF NOT EXISTS standings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    standing INTEGER,  -- 최종 순위
    UNIQUE(season_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_standings_season ON standings(season_id);

-- 플레이오프 결과 (sponsorEngine 참조)
CREATE TABLE IF NOT EXISTS playoff_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    final_rank INTEGER NOT NULL,  -- 1=우승, 2=준우승, 3-4=4강 등
    UNIQUE(season_id, team_id)
);

-- 팀 케미스트리 요약 (achievementEngine 참조)
CREATE TABLE IF NOT EXISTS team_chemistry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    player_a_id TEXT NOT NULL,
    player_b_id TEXT NOT NULL,
    value REAL NOT NULL DEFAULT 50,
    UNIQUE(team_id, player_a_id, player_b_id)
);

-- 선수 컨디션 테이블 (코드에서 player_conditions로 참조하던 것의 별칭)
-- player_daily_condition이 이미 존재하므로 뷰로 생성
CREATE VIEW IF NOT EXISTS player_conditions AS
SELECT * FROM player_daily_condition;
