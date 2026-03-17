-- 성능 인덱스 추가

-- 선수: 팀 ID 기반 조회 (로스터 조회)
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);

-- 매치: 시즌 + 날짜 기반 조회 (일간 경기 조회)
CREATE INDEX IF NOT EXISTS idx_matches_season_date ON matches(season_id, match_date);

-- 매치: 시즌 + 주차 기반 조회
CREATE INDEX IF NOT EXISTS idx_matches_season_week ON matches(season_id, week);

-- 게임(세트): 매치 ID 기반 조회
CREATE INDEX IF NOT EXISTS idx_games_match_id ON games(match_id);

-- 챔피언 숙련도: 선수 ID 기반 조회
CREATE INDEX IF NOT EXISTS idx_champion_proficiency_player ON champion_proficiency(player_id);

-- 일간 이벤트: 시즌 + 날짜 기반 조회
CREATE INDEX IF NOT EXISTS idx_daily_events_season_date ON daily_events(season_id, game_date);

-- 선수 일일 컨디션: 선수 + 날짜 기반 조회
CREATE INDEX IF NOT EXISTS idx_player_condition_player_date ON player_daily_condition(player_id, game_date);
