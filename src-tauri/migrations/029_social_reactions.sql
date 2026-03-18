-- 커뮤니티 소셜 반응 시스템
CREATE TABLE IF NOT EXISTS social_reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_date TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    related_team_id TEXT,
    related_player_id TEXT,
    related_staff_id INTEGER,
    community_source TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reaction_id INTEGER NOT NULL REFERENCES social_reactions(id),
    username TEXT NOT NULL,
    comment TEXT NOT NULL,
    likes INTEGER NOT NULL DEFAULT 0,
    sentiment TEXT NOT NULL DEFAULT 'neutral',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_social_reactions_date ON social_reactions(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_social_reactions_season ON social_reactions(season_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_reaction ON social_comments(reaction_id);
