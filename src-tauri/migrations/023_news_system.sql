CREATE TABLE IF NOT EXISTS news_articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    article_date TEXT NOT NULL,
    category TEXT NOT NULL,     -- match_result/transfer_rumor/player_complaint/team_analysis/interview/social_media
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    related_team_id TEXT REFERENCES teams(id),
    related_player_id TEXT REFERENCES players(id),
    importance INTEGER NOT NULL DEFAULT 1,  -- 1(일반)~3(핵심)
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_season ON news_articles(season_id, article_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_team ON news_articles(related_team_id);
