-- 계약 협상 테이블
-- 감독↔선수 양방향 재계약/신규 계약 협상 관리
CREATE TABLE IF NOT EXISTS contract_negotiations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL REFERENCES seasons(id),
    player_id TEXT NOT NULL REFERENCES players(id),
    team_id TEXT NOT NULL REFERENCES teams(id),
    -- 'team_to_player' (팀→선수 재계약 제안) | 'player_to_team' (선수→팀 계약 요청)
    initiator TEXT NOT NULL CHECK(initiator IN ('team_to_player', 'player_to_team')),
    -- 'pending' | 'in_progress' | 'accepted' | 'rejected' | 'expired'
    status TEXT NOT NULL DEFAULT 'pending',
    -- 현재 라운드 (최대 3)
    current_round INTEGER NOT NULL DEFAULT 1,
    -- 팀 측 제안
    team_salary INTEGER NOT NULL DEFAULT 0,
    team_years INTEGER NOT NULL DEFAULT 1,
    team_signing_bonus INTEGER NOT NULL DEFAULT 0,
    -- 선수 측 요구/역제안
    player_salary INTEGER,
    player_years INTEGER,
    player_signing_bonus INTEGER,
    -- 선수 의사결정 요인 점수 (0~100)
    factor_money INTEGER DEFAULT 50,
    factor_winning INTEGER DEFAULT 50,
    factor_playtime INTEGER DEFAULT 50,
    factor_loyalty INTEGER DEFAULT 50,
    factor_reputation INTEGER DEFAULT 50,
    -- 최종 합의 조건
    final_salary INTEGER,
    final_years INTEGER,
    final_signing_bonus INTEGER,
    -- 메시지 로그 (JSON 배열)
    messages TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contract_neg_player ON contract_negotiations(player_id, status);
CREATE INDEX IF NOT EXISTS idx_contract_neg_team ON contract_negotiations(team_id, status);
CREATE INDEX IF NOT EXISTS idx_contract_neg_season ON contract_negotiations(season_id);
