-- 매치 테이블에 플레이오프 관련 컬럼 추가
ALTER TABLE matches ADD COLUMN match_type TEXT NOT NULL DEFAULT 'regular';
-- match_type: 'regular' | 'playoff_quarters' | 'playoff_semis' | 'playoff_finals'

ALTER TABLE matches ADD COLUMN bo_format TEXT NOT NULL DEFAULT 'Bo3';
-- bo_format: 'Bo1' | 'Bo3' | 'Bo5'
