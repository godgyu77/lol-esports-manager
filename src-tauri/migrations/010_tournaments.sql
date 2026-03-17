-- 국제 대회 (MSI / Worlds) 테이블
CREATE TABLE IF NOT EXISTS tournaments (
  id         TEXT    PRIMARY KEY,
  type       TEXT    NOT NULL CHECK (type IN ('msi', 'worlds')),
  year       INTEGER NOT NULL,
  season_id  INTEGER NOT NULL REFERENCES seasons(id),
  start_date TEXT    NOT NULL,
  end_date   TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'scheduled'
             CHECK (status IN ('scheduled', 'group_stage', 'knockout', 'completed'))
);

CREATE TABLE IF NOT EXISTS tournament_participants (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  team_id       TEXT NOT NULL REFERENCES teams(id),
  region        TEXT NOT NULL,
  seed          INTEGER NOT NULL,
  group_name    TEXT,
  PRIMARY KEY (tournament_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_tournaments_year ON tournaments(year);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament ON tournament_participants(tournament_id);
