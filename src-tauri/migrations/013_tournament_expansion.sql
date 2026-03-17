-- 스위스 스테이지 전적 추적 테이블
CREATE TABLE IF NOT EXISTS swiss_records (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  team_id       TEXT NOT NULL REFERENCES teams(id),
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  round         INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'advanced', 'eliminated')),
  PRIMARY KEY (tournament_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_swiss_records_tournament ON swiss_records(tournament_id);

-- 피어리스 드래프트 플래그
ALTER TABLE matches ADD COLUMN fearless_draft BOOLEAN NOT NULL DEFAULT FALSE;
