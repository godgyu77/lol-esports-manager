CREATE TABLE IF NOT EXISTS career_arc_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  save_id INTEGER NOT NULL,
  team_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  arc_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  consequences_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_career_arc_events_save_team
  ON career_arc_events (save_id, team_id, season_id, started_at DESC);

CREATE TABLE IF NOT EXISTS team_history_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL,
  season_id INTEGER NOT NULL,
  ledger_type TEXT NOT NULL,
  subject_id TEXT,
  subject_name TEXT NOT NULL,
  opponent_team_id TEXT,
  stat_value INTEGER NOT NULL DEFAULT 0,
  secondary_value INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  extra_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_history_ledger_team
  ON team_history_ledger (team_id, season_id, ledger_type, updated_at DESC);
