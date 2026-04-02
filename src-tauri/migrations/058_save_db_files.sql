ALTER TABLE save_metadata ADD COLUMN db_filename TEXT NOT NULL DEFAULT 'autosave.db';
ALTER TABLE save_metadata ADD COLUMN game_save_id INTEGER NOT NULL DEFAULT 1;

UPDATE save_metadata
SET db_filename = CASE
  WHEN slot_number = 0 THEN 'autosave.db'
  ELSE 'slot_' || slot_number || '.db'
END
WHERE db_filename = '' OR db_filename IS NULL OR db_filename = 'autosave.db';

UPDATE save_metadata
SET game_save_id = 1
WHERE game_save_id IS NULL OR game_save_id <= 0;
