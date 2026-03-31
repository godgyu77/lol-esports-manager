ALTER TABLE training_schedule
ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'training';

UPDATE training_schedule
SET activity_type = CASE
  WHEN day_of_week = 0 THEN 'rest'
  WHEN day_of_week IN (1, 2) THEN 'scrim'
  ELSE 'training'
END
WHERE activity_type IS NULL
   OR activity_type = ''
   OR activity_type = 'training';
