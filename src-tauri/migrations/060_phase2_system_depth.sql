CREATE TABLE IF NOT EXISTS prep_recommendation_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK(source IN ('opponent_analysis', 'coach_briefing', 'post_match')),
  focus_area TEXT NOT NULL CHECK(focus_area IN ('training', 'tactics', 'analysis')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommended_changes TEXT NOT NULL DEFAULT '[]',
  applied_changes TEXT NOT NULL DEFAULT '[]',
  target_match_id TEXT REFERENCES matches(id) ON DELETE SET NULL,
  target_date TEXT,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK(status IN ('suggested', 'applied', 'observed', 'expired')),
  observed_outcome TEXT,
  impact_summary TEXT,
  created_date TEXT NOT NULL,
  resolved_date TEXT
);

CREATE INDEX IF NOT EXISTS idx_prep_recommendation_team_status
  ON prep_recommendation_records(team_id, season_id, status, created_date DESC);

CREATE TABLE IF NOT EXISTS ongoing_consequences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  consequence_type TEXT NOT NULL CHECK(consequence_type IN ('morale', 'budget', 'staff', 'media', 'training')),
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high')),
  started_date TEXT NOT NULL,
  expires_date TEXT NOT NULL,
  stat_key TEXT,
  stat_delta REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ongoing_consequences_team_expiry
  ON ongoing_consequences(team_id, season_id, expires_date);
