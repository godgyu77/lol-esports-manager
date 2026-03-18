CREATE TABLE IF NOT EXISTS league_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT NOT NULL UNIQUE,
    max_foreign_players INTEGER NOT NULL DEFAULT 2,
    min_local_players INTEGER NOT NULL DEFAULT 3,
    roster_size_limit INTEGER NOT NULL DEFAULT 10
);

INSERT OR IGNORE INTO league_rules (region, max_foreign_players, min_local_players, roster_size_limit) VALUES
  ('LCK', 2, 3, 10),
  ('LPL', 2, 3, 10),
  ('LEC', 2, 3, 10),
  ('LCS', 3, 2, 10);
