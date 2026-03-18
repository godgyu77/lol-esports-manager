-- staff 테이블 team_id NULL 허용 + is_free_agent 필드 추가
CREATE TABLE IF NOT EXISTS staff_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT REFERENCES teams(id),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    ability INTEGER NOT NULL DEFAULT 50,
    specialty TEXT,
    salary INTEGER NOT NULL DEFAULT 1000,
    morale INTEGER NOT NULL DEFAULT 70,
    contract_end_season INTEGER NOT NULL DEFAULT 0,
    hired_date TEXT NOT NULL,
    is_free_agent INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO staff_new SELECT id, team_id, name, role, ability, specialty, salary, morale, contract_end_season, hired_date, 0, created_at FROM staff;
DROP TABLE staff;
ALTER TABLE staff_new RENAME TO staff;
CREATE INDEX IF NOT EXISTS idx_staff_team ON staff(team_id);
CREATE INDEX IF NOT EXISTS idx_staff_fa ON staff(is_free_agent);
