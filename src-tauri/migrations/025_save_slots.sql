-- 저장 슬롯 시스템 확장
ALTER TABLE save_metadata ADD COLUMN slot_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE save_metadata ADD COLUMN save_name TEXT NOT NULL DEFAULT '자동 저장';
ALTER TABLE save_metadata ADD COLUMN play_time_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE save_metadata ADD COLUMN team_name TEXT;
ALTER TABLE save_metadata ADD COLUMN season_info TEXT;
