/**
 * AI 프롬프트 컨텍스트 빌더
 * - 게임 DB에서 풍부한 컨텍스트를 수집하여 LLM 프롬프트에 주입
 * - 모든 쿼리는 try/catch로 감싸서 실패해도 빈 문자열 반환
 * - 결과는 한국어 텍스트, 최대 500자 제한
 */

import { getDatabase } from '../db/database';
import { getPlayerChemistryLinks } from '../db/queries';

// ─────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────

/** 텍스트를 maxLen 이내로 자르되, 마지막 줄을 깨지 않도록 처리 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastNewline = cut.lastIndexOf('\n');
  return (lastNewline > maxLen * 0.6 ? cut.slice(0, lastNewline) : cut) + '...';
}

/** OVR 계산: 주요 6스탯 가중 평균 */
function calcOvr(row: {
  mechanical: number;
  game_sense: number;
  teamwork: number;
  consistency: number;
  laning: number;
  aggression: number;
}): number {
  return Math.round(
    row.mechanical * 0.2 +
      row.game_sense * 0.2 +
      row.teamwork * 0.15 +
      row.consistency * 0.15 +
      row.laning * 0.15 +
      row.aggression * 0.15,
  );
}

/** 폼 화살표 표기 */
function formArrow(form: number): string {
  if (form >= 70) return '\u2191'; // ↑
  if (form <= 30) return '\u2193'; // ↓
  return '\u2192'; // →
}

const POS_KR: Record<string, string> = {
  top: '탑',
  jungle: '정글',
  mid: '미드',
  adc: '원딜',
  support: '서포터',
};

// ─────────────────────────────────────────
// 팀 ID 조회 헬퍼
// ─────────────────────────────────────────

/** 팀 이름으로 팀 ID 조회 */
export async function resolveTeamId(teamName: string): Promise<string | null> {
  try {
    const db = await getDatabase();
    const rows = await db.select<{ id: string }[]>(
      'SELECT id FROM teams WHERE name = $1',
      [teamName],
    );
    return rows.length > 0 ? rows[0].id : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// 팀 전체 상태 컨텍스트
// ─────────────────────────────────────────

/**
 * 팀 전체 상태 컨텍스트 수집
 * 팀 정보, 선수 목록, 부상자, 갈등, 최근 경기, 재정 등
 */
export async function buildTeamContext(teamId: string): Promise<string> {
  try {
    const db = await getDatabase();
    const parts: string[] = [];

    // 1. 팀 기본 정보
    const [team] = await db.select<
      { name: string; budget: number; salary_cap: number; reputation: number }[]
    >('SELECT name, budget, salary_cap, reputation FROM teams WHERE id = $1', [teamId]);
    if (!team) return '';

    // 2. 시즌 승패 집계
    const [season] = await db.select<{ id: number }[]>(
      'SELECT id FROM seasons WHERE is_active = 1 LIMIT 1',
    );
    let record = '';
    if (season) {
      const [wl] = await db.select<{ wins: number; losses: number }[]>(
        `SELECT
          COALESCE(SUM(CASE
            WHEN (team_home_id = $1 AND score_home > score_away)
              OR (team_away_id = $1 AND score_away > score_home) THEN 1 ELSE 0 END), 0) AS wins,
          COALESCE(SUM(CASE
            WHEN (team_home_id = $1 AND score_home < score_away)
              OR (team_away_id = $1 AND score_away < score_home) THEN 1 ELSE 0 END), 0) AS losses
        FROM matches
        WHERE season_id = $2 AND is_played = 1
          AND (team_home_id = $1 OR team_away_id = $1)`,
        [teamId, season.id],
      );
      if (wl) record = `, ${wl.wins}승 ${wl.losses}패`;
    }

    parts.push(`${team.name}${record}`);

    // 3. 선수 목록 (이름, 포지션, OVR, 폼)
    const players = await db.select<
      {
        id: string;
        name: string;
        position: string;
        mechanical: number;
        game_sense: number;
        teamwork: number;
        consistency: number;
        laning: number;
        aggression: number;
        morale: number;
      }[]
    >(
      `SELECT id, name, position, mechanical, game_sense, teamwork, consistency, laning, aggression, morale
       FROM players WHERE team_id = $1 ORDER BY position`,
      [teamId],
    );

    // 최근 폼 조회
    const formMap = new Map<string, number>();
    if (players.length > 0) {
      const playerIds = players.map((p) => p.id);
      const placeholders = playerIds.map((_, i) => `$${i + 1}`).join(',');
      const formRows = await db.select<{ player_id: string; avg_form: number }[]>(
        `SELECT player_id, ROUND(AVG(form_score)) AS avg_form
         FROM (SELECT player_id, form_score,
               ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date DESC) AS rn
               FROM player_form_history
               WHERE player_id IN (${placeholders}))
         WHERE rn <= 3
         GROUP BY player_id`,
        playerIds,
      );
      for (const f of formRows) formMap.set(f.player_id, f.avg_form);
    }

    if (players.length > 0) {
      const lines = players.map((p) => {
        const ovr = calcOvr(p);
        const form = formMap.get(p.id) ?? 50;
        return `${p.name}(${POS_KR[p.position] ?? p.position} OVR${ovr} 폼${formArrow(form)} 사기${p.morale})`;
      });
      parts.push('선수: ' + lines.join(', '));
    }

    // 4. 부상자
    const injuries = await db.select<{ name: string; injury_type: string; days_remaining: number }[]>(
      `SELECT p.name, i.injury_type, i.days_remaining
       FROM player_injuries i JOIN players p ON i.player_id = p.id
       WHERE i.team_id = $1 AND i.is_recovered = 0`,
      [teamId],
    );
    if (injuries.length > 0) {
      parts.push(
        '부상: ' + injuries.map((i) => `${i.name}(${i.injury_type} ${i.days_remaining}일)`).join(', '),
      );
    }

    // 5. 활성 불만/갈등
    const complaints = await db.select<{ name: string; complaint_type: string; severity: number }[]>(
      `SELECT p.name, c.complaint_type, c.severity
       FROM player_complaints c JOIN players p ON c.player_id = p.id
       WHERE c.team_id = $1 AND c.status = 'active'
       ORDER BY c.severity DESC LIMIT 3`,
      [teamId],
    );
    if (complaints.length > 0) {
      parts.push(
        '불만: ' + complaints.map((c) => `${c.name}(${c.complaint_type} 심각도${c.severity})`).join(', '),
      );
    }

    // 6. 최근 3경기 결과
    if (season) {
      const recentMatches = await db.select<
        { home_name: string; away_name: string; score_home: number; score_away: number }[]
      >(
        `SELECT th.name AS home_name, ta.name AS away_name, m.score_home, m.score_away
         FROM matches m
         JOIN teams th ON m.team_home_id = th.id
         JOIN teams ta ON m.team_away_id = ta.id
         WHERE m.season_id = $2 AND m.is_played = 1
           AND (m.team_home_id = $1 OR m.team_away_id = $1)
         ORDER BY m.played_at DESC LIMIT 3`,
        [teamId, season.id],
      );
      if (recentMatches.length > 0) {
        const results = recentMatches.map(
          (m) => `${m.home_name} ${m.score_home}:${m.score_away} ${m.away_name}`,
        );
        parts.push('최근경기: ' + results.join(' / '));
      }
    }

    // 7. 팀 평균 케미스트리
    const [chem] = await db.select<{ avg_chem: number }[]>(
      `SELECT ROUND(AVG(chemistry_score)) AS avg_chem
       FROM player_chemistry
       WHERE player_a_id IN (SELECT id FROM players WHERE team_id = $1)
         AND player_b_id IN (SELECT id FROM players WHERE team_id = $1)`,
      [teamId],
    );
    if (chem?.avg_chem) {
      parts.push(`팀케미: ${chem.avg_chem}/100`);
    }

    // 8. 활성 약속
    const promises = await db.select<{ name: string; promise_type: string }[]>(
      `SELECT p.name, mp.promise_type
       FROM manager_promises mp JOIN players p ON mp.player_id = p.id
       WHERE mp.team_id = $1 AND mp.is_fulfilled = 0 AND mp.is_broken = 0
       LIMIT 3`,
      [teamId],
    );
    if (promises.length > 0) {
      parts.push('약속: ' + promises.map((p) => `${p.name}(${p.promise_type})`).join(', '));
    }

    // 9. 재정
    parts.push(`예산: ${Math.round(team.budget / 10000)}억 / 연봉캡: ${Math.round(team.salary_cap / 10000)}억`);

    return truncate(parts.join('\n'), 500);
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────
// 선수 개인 컨텍스트
// ─────────────────────────────────────────

/**
 * 선수 개인 컨텍스트 수집
 * 기본 정보, 성격, KDA, 폼 추세, 만족도, 계약, 솔로랭크, 케미스트리 등
 */
export async function buildPlayerContext(playerId: string): Promise<string> {
  try {
    const db = await getDatabase();
    const parts: string[] = [];

    // 1. 선수 기본 정보
    const [player] = await db.select<
      {
        name: string;
        age: number;
        position: string;
        mechanical: number;
        game_sense: number;
        teamwork: number;
        consistency: number;
        laning: number;
        aggression: number;
        morale: number;
        potential: number;
        salary: number;
        contract_end_season: number;
        team_id: string;
      }[]
    >(
      `SELECT name, age, position, mechanical, game_sense, teamwork, consistency,
              laning, aggression, morale, potential, salary, contract_end_season, team_id
       FROM players WHERE id = $1`,
      [playerId],
    );
    if (!player) return '';

    const ovr = calcOvr(player);
    parts.push(
      `${player.name} (${POS_KR[player.position] ?? player.position}, ${player.age}세, OVR${ovr}, 잠재력${player.potential})`,
    );

    // 2. 성격
    const [personality] = await db.select<
      {
        ambition: number;
        loyalty: number;
        professionalism: number;
        temperament: number;
        determination: number;
      }[]
    >('SELECT ambition, loyalty, professionalism, temperament, determination FROM player_personality WHERE player_id = $1', [playerId]);
    if (personality) {
      parts.push(
        `성격: 야망${personality.ambition} 충성${personality.loyalty} 프로의식${personality.professionalism} 기질${personality.temperament} 결단${personality.determination}`,
      );
    }

    // 3. 최근 5경기 KDA
    const kdaRows = await db.select<{ kills: number; deaths: number; assists: number }[]>(
      `SELECT kills, deaths, assists FROM player_game_stats
       WHERE player_id = $1 ORDER BY rowid DESC LIMIT 5`,
      [playerId],
    );
    if (kdaRows.length > 0) {
      const totals = kdaRows.reduce(
        (acc, r) => ({ k: acc.k + r.kills, d: acc.d + r.deaths, a: acc.a + r.assists }),
        { k: 0, d: 0, a: 0 },
      );
      const n = kdaRows.length;
      const avgKda =
        totals.d === 0
          ? ((totals.k + totals.a) / n).toFixed(1)
          : ((totals.k + totals.a) / totals.d).toFixed(1);
      parts.push(`최근${n}경기 KDA: ${(totals.k / n).toFixed(1)}/${(totals.d / n).toFixed(1)}/${(totals.a / n).toFixed(1)} (${avgKda})`);
    }

    // 4. 폼 추세
    const formRows = await db.select<{ form_score: number }[]>(
      `SELECT form_score FROM player_form_history
       WHERE player_id = $1 ORDER BY game_date DESC LIMIT 5`,
      [playerId],
    );
    if (formRows.length >= 2) {
      const recent = formRows[0].form_score;
      const older = formRows[formRows.length - 1].form_score;
      const trend = recent > older + 5 ? '상승' : recent < older - 5 ? '하락' : '유지';
      parts.push(`폼: ${recent}/100 (${trend}중)`);
    }

    // 5. 만족도 6요소
    const [sat] = await db.select<
      {
        overall_satisfaction: number;
        playtime_satisfaction: number;
        salary_satisfaction: number;
        team_performance_satisfaction: number;
        personal_performance_satisfaction: number;
        role_clarity: number;
      }[]
    >('SELECT * FROM player_satisfaction WHERE player_id = $1', [playerId]);
    if (sat) {
      parts.push(
        `만족도: 종합${sat.overall_satisfaction} 출전${sat.playtime_satisfaction} 연봉${sat.salary_satisfaction} 팀성적${sat.team_performance_satisfaction} 개인${sat.personal_performance_satisfaction} 역할${sat.role_clarity}`,
      );
    }

    // 6. 계약
    parts.push(`계약: 연봉${Math.round(player.salary / 10000)}억, 만료 시즌${player.contract_end_season}`);

    // 7. 솔로랭크
    const [rank] = await db.select<{ tier: string; lp: number }[]>(
      'SELECT tier, lp FROM player_solo_rank WHERE player_id = $1',
      [playerId],
    );
    if (rank) {
      parts.push(`솔로랭크: ${rank.tier} ${rank.lp}LP`);
    }

    // 8. 케미스트리 (가장 높은/낮은)
    if (player.team_id) {
      const chemistryLinks = await getPlayerChemistryLinks(playerId);
      const teammateIds = chemistryLinks.map((link) => link.otherPlayerId);
      let bestChem: { name: string; chemistry_score: number }[] = [];
      let worstChem: { name: string; chemistry_score: number }[] = [];

      if (teammateIds.length > 0) {
        const placeholders = teammateIds.map((_, index) => `$${index + 2}`).join(', ');
        const chemistryRows = await db.select<{ id: string; name: string }[]>(
          `SELECT id, name FROM players
           WHERE team_id = $1 AND id IN (${placeholders})`,
          [player.team_id, ...teammateIds],
        );
        const nameById = new Map(chemistryRows.map((row) => [row.id, row.name]));
        const teammateChemistry = chemistryLinks
          .filter((link) => nameById.has(link.otherPlayerId))
          .map((link) => ({
            name: nameById.get(link.otherPlayerId) ?? link.otherPlayerId,
            chemistry_score: link.chemistryScore,
          }))
          .sort((a, b) => b.chemistry_score - a.chemistry_score);

        if (teammateChemistry.length > 0) {
          bestChem = [teammateChemistry[0]];
          worstChem = [teammateChemistry[teammateChemistry.length - 1]];
        }
      }
      const chemParts: string[] = [];
      if (bestChem.length > 0) chemParts.push(`최고: ${bestChem[0].name}(${bestChem[0].chemistry_score})`);
      if (worstChem.length > 0) chemParts.push(`최저: ${worstChem[0].name}(${worstChem[0].chemistry_score})`);
      if (chemParts.length > 0) parts.push('케미: ' + chemParts.join(', '));
    }

    return truncate(parts.join('\n'), 500);
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────
// 경기 컨텍스트
// ─────────────────────────────────────────

/**
 * 경기 컨텍스트 수집
 * 양 팀 기본 정보, 상대 전적, 경기 결과, 주요 매치업
 */
export async function buildMatchContext(
  homeTeamId: string,
  awayTeamId: string,
  matchResult?: { scoreHome: number; scoreAway: number; mvpName?: string; duration?: number },
): Promise<string> {
  try {
    const db = await getDatabase();
    const parts: string[] = [];

    // 1. 양 팀 기본 정보
    const teams = await db.select<{ id: string; name: string; reputation: number }[]>(
      'SELECT id, name, reputation FROM teams WHERE id IN ($1, $2)',
      [homeTeamId, awayTeamId],
    );
    const home = teams.find((t) => t.id === homeTeamId);
    const away = teams.find((t) => t.id === awayTeamId);
    if (!home || !away) return '';

    // 시즌 승패
    const [season] = await db.select<{ id: number }[]>(
      'SELECT id FROM seasons WHERE is_active = 1 LIMIT 1',
    );

    const getRecord = async (tid: string): Promise<string> => {
      if (!season) return '';
      const [wl] = await db.select<{ wins: number; losses: number }[]>(
        `SELECT
          COALESCE(SUM(CASE WHEN (team_home_id = $1 AND score_home > score_away)
            OR (team_away_id = $1 AND score_away > score_home) THEN 1 ELSE 0 END), 0) AS wins,
          COALESCE(SUM(CASE WHEN (team_home_id = $1 AND score_home < score_away)
            OR (team_away_id = $1 AND score_away < score_home) THEN 1 ELSE 0 END), 0) AS losses
        FROM matches WHERE season_id = $2 AND is_played = 1
          AND (team_home_id = $1 OR team_away_id = $1)`,
        [tid, season.id],
      );
      return wl ? `${wl.wins}승${wl.losses}패` : '';
    };

    const homeRec = await getRecord(homeTeamId);
    const awayRec = await getRecord(awayTeamId);
    parts.push(`${home.name}(${homeRec}) vs ${away.name}(${awayRec})`);

    // 2. 시즌 내 상대 전적
    if (season) {
      const h2h = await db.select<{ score_home: number; score_away: number; team_home_id: string }[]>(
        `SELECT score_home, score_away, team_home_id FROM matches
         WHERE season_id = $3 AND is_played = 1
           AND ((team_home_id = $1 AND team_away_id = $2) OR (team_home_id = $2 AND team_away_id = $1))`,
        [homeTeamId, awayTeamId, season.id],
      );
      if (h2h.length > 0) {
        let homeWins = 0;
        let awayWins = 0;
        for (const m of h2h) {
          const homeIsHome = m.team_home_id === homeTeamId;
          const hw = homeIsHome ? m.score_home : m.score_away;
          const aw = homeIsHome ? m.score_away : m.score_home;
          if (hw > aw) homeWins++;
          else awayWins++;
        }
        parts.push(`시즌 상대전적: ${home.name} ${homeWins}-${awayWins} ${away.name}`);
      }
    }

    // 3. 경기 결과
    if (matchResult) {
      const winner =
        matchResult.scoreHome > matchResult.scoreAway ? home.name : away.name;
      parts.push(
        `결과: ${matchResult.scoreHome}:${matchResult.scoreAway} (${winner} 승)` +
          (matchResult.mvpName ? ` MVP: ${matchResult.mvpName}` : '') +
          (matchResult.duration ? ` ${Math.round(matchResult.duration / 60)}분` : ''),
      );
    }

    // 4. 주요 선수 매치업 (같은 포지션 OVR 비교)
    const homePlayers = await db.select<
      { name: string; position: string; mechanical: number; game_sense: number; teamwork: number; consistency: number; laning: number; aggression: number }[]
    >('SELECT name, position, mechanical, game_sense, teamwork, consistency, laning, aggression FROM players WHERE team_id = $1', [homeTeamId]);
    const awayPlayers = await db.select<
      { name: string; position: string; mechanical: number; game_sense: number; teamwork: number; consistency: number; laning: number; aggression: number }[]
    >('SELECT name, position, mechanical, game_sense, teamwork, consistency, laning, aggression FROM players WHERE team_id = $1', [awayTeamId]);

    const matchups: string[] = [];
    for (const hp of homePlayers) {
      const ap = awayPlayers.find((a) => a.position === hp.position);
      if (ap) {
        const hOvr = calcOvr(hp);
        const aOvr = calcOvr(ap);
        matchups.push(`${POS_KR[hp.position] ?? hp.position}: ${hp.name}(${hOvr}) vs ${ap.name}(${aOvr})`);
      }
    }
    if (matchups.length > 0) {
      parts.push('매치업: ' + matchups.join(', '));
    }

    return truncate(parts.join('\n'), 500);
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────
// 이적 시장 컨텍스트
// ─────────────────────────────────────────

/**
 * 이적 시장 컨텍스트 수집
 * 팀 예산, 포지션 현황, 대상 선수 정보, 리그 평균 연봉
 */
export async function buildTransferContext(
  teamId: string,
  playerId: string,
): Promise<string> {
  try {
    const db = await getDatabase();
    const parts: string[] = [];

    // 1. 팀 예산/연봉 현황
    const [team] = await db.select<{ name: string; budget: number; salary_cap: number }[]>(
      'SELECT name, budget, salary_cap FROM teams WHERE id = $1',
      [teamId],
    );
    if (!team) return '';

    const [salarySum] = await db.select<{ total: number }[]>(
      'SELECT COALESCE(SUM(salary), 0) AS total FROM players WHERE team_id = $1',
      [teamId],
    );
    const totalSalary = salarySum?.total ?? 0;
    const capRemaining = team.salary_cap - totalSalary;

    parts.push(
      `${team.name} 재정: 예산${Math.round(team.budget / 10000)}억, 연봉총합${Math.round(totalSalary / 10000)}억, 캡잔여${Math.round(capRemaining / 10000)}억`,
    );

    // 2. 포지션별 선수 현황
    const roster = await db.select<{ position: string; cnt: number }[]>(
      `SELECT position, COUNT(*) AS cnt FROM players WHERE team_id = $1 GROUP BY position`,
      [teamId],
    );
    const posMap = new Map(roster.map((r) => [r.position, r.cnt]));
    const positions = ['top', 'jungle', 'mid', 'adc', 'support'];
    const posStatus = positions.map((pos) => {
      const cnt = posMap.get(pos) ?? 0;
      const label = POS_KR[pos] ?? pos;
      return cnt === 0 ? `${label}(보강필요)` : `${label}(${cnt}명)`;
    });
    parts.push('로스터: ' + posStatus.join(', '));

    // 3. 대상 선수 정보
    const [target] = await db.select<
      {
        name: string;
        age: number;
        position: string;
        mechanical: number;
        game_sense: number;
        teamwork: number;
        consistency: number;
        laning: number;
        aggression: number;
        salary: number;
        potential: number;
        buyout_clause: number;
      }[]
    >(
      `SELECT name, age, position, mechanical, game_sense, teamwork, consistency,
              laning, aggression, salary, potential, buyout_clause
       FROM players WHERE id = $1`,
      [playerId],
    );
    if (target) {
      const ovr = calcOvr(target);
      parts.push(
        `대상: ${target.name} (${POS_KR[target.position] ?? target.position}, ${target.age}세, OVR${ovr}, 잠재력${target.potential}, 연봉${Math.round(target.salary / 10000)}억` +
          (target.buyout_clause > 0 ? `, 위약금${Math.round(target.buyout_clause / 10000)}억` : '') +
          ')',
      );
    }

    // 4. 리그 평균 연봉
    const [avgSalary] = await db.select<{ avg_sal: number }[]>(
      'SELECT ROUND(AVG(salary)) AS avg_sal FROM players WHERE salary > 0',
    );
    if (avgSalary?.avg_sal) {
      parts.push(`리그 평균 연봉: ${Math.round(avgSalary.avg_sal / 10000)}억`);
    }

    return truncate(parts.join('\n'), 500);
  } catch {
    return '';
  }
}
