-- achievements 테이블 (achievementEngine에서 사용)
CREATE TABLE IF NOT EXISTS achievements (
    save_id INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_date TEXT NOT NULL,
    PRIMARY KEY (save_id, achievement_id)
);
