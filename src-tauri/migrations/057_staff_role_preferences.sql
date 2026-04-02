ALTER TABLE staff ADD COLUMN preferred_role TEXT DEFAULT NULL;
ALTER TABLE staff ADD COLUMN role_flexibility TEXT DEFAULT 'normal';
ALTER TABLE staff ADD COLUMN career_origin TEXT DEFAULT NULL;

UPDATE staff
SET preferred_role = role
WHERE preferred_role IS NULL;

UPDATE staff
SET role_flexibility = CASE
  WHEN role = 'head_coach' THEN 'strict'
  WHEN role IN ('coach', 'analyst', 'data_analyst') THEN 'normal'
  ELSE 'flexible'
END
WHERE role_flexibility IS NULL OR role_flexibility = 'normal';
