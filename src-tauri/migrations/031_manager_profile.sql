CREATE TABLE IF NOT EXISTS manager_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    save_id INTEGER REFERENCES save_metadata(id),
    name TEXT NOT NULL,
    nationality TEXT NOT NULL DEFAULT 'KR',
    age INTEGER NOT NULL DEFAULT 35,
    background TEXT NOT NULL DEFAULT 'analyst',  -- ex_player/analyst/rookie/academy_coach
    -- 감독 능력치 (각 1~20)
    tactical_knowledge INTEGER NOT NULL DEFAULT 10,
    motivation INTEGER NOT NULL DEFAULT 10,
    discipline INTEGER NOT NULL DEFAULT 10,
    adaptability INTEGER NOT NULL DEFAULT 10,
    scouting_eye INTEGER NOT NULL DEFAULT 10,
    media_handling INTEGER NOT NULL DEFAULT 10,
    reputation INTEGER NOT NULL DEFAULT 30,       -- 0-100 감독 명성
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
