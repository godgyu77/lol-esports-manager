-- 스태프 테이블
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id TEXT NOT NULL REFERENCES teams(id),
    name TEXT NOT NULL,
    role TEXT NOT NULL,                         -- head_coach/coach/analyst/scout_manager
    ability INTEGER NOT NULL DEFAULT 50,        -- 능력치 (0-100)
    specialty TEXT,                              -- 특화 분야 (training/draft/mentoring/conditioning)
    salary INTEGER NOT NULL DEFAULT 1000,       -- 연봉 (만 원)
    morale INTEGER NOT NULL DEFAULT 70,         -- 사기
    contract_end_season INTEGER NOT NULL,
    hired_date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_team ON staff(team_id);
