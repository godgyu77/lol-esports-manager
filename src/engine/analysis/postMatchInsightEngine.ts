import type { GameResult, PlayerGameStatLine } from '../match/matchSimulator';

export type MatchInsightImpact = 'high' | 'medium' | 'low';
export type MatchInsightAction =
  | '전술 재검토'
  | '훈련 조정'
  | '선수 컨디션 관리'
  | '드래프트 우선순위 재점검'
  | '로스터 변경 검토';

export interface MatchInsightReason {
  title: string;
  summary: string;
  impact: MatchInsightImpact;
  nextAction: MatchInsightAction;
}

export interface PostMatchInsightReport {
  headline: string;
  outcomeLabel: string;
  reasons: MatchInsightReason[];
  recommendedActions: MatchInsightAction[];
}

function sumTeamKda(stats: PlayerGameStatLine[]) {
  return stats.reduce(
    (acc, player) => {
      acc.kills += player.kills;
      acc.deaths += player.deaths;
      acc.assists += player.assists;
      acc.damage += player.damageDealt;
      return acc;
    },
    { kills: 0, deaths: 0, assists: 0, damage: 0 },
  );
}

function impactFromValue(value: number): MatchInsightImpact {
  if (value >= 0.75) return 'high';
  if (value >= 0.4) return 'medium';
  return 'low';
}

function dedupeActions(reasons: MatchInsightReason[]): MatchInsightAction[] {
  return Array.from(new Set(reasons.map((reason) => reason.nextAction))).slice(0, 3);
}

export function buildPostMatchInsightReport(
  gameResult: GameResult,
  perspectiveSide: 'home' | 'away',
): PostMatchInsightReport {
  const isPerspectiveWin = gameResult.winnerSide === perspectiveSide;
  const ownKills = perspectiveSide === 'home' ? gameResult.killsHome : gameResult.killsAway;
  const ownGold = perspectiveSide === 'home' ? gameResult.goldHome : gameResult.goldAway;
  const ownTowers = perspectiveSide === 'home' ? gameResult.towersHome : gameResult.towersAway;
  const ownGrubs = perspectiveSide === 'home' ? gameResult.grubsHome : gameResult.grubsAway;
  const ownStats = perspectiveSide === 'home' ? gameResult.playerStatsHome : gameResult.playerStatsAway;
  const enemyStats = perspectiveSide === 'home' ? gameResult.playerStatsAway : gameResult.playerStatsHome;
  const enemyKills = perspectiveSide === 'home' ? gameResult.killsAway : gameResult.killsHome;
  const enemyGold = perspectiveSide === 'home' ? gameResult.goldAway : gameResult.goldHome;
  const enemyTowers = perspectiveSide === 'home' ? gameResult.towersAway : gameResult.towersHome;
  const enemyGrubs = perspectiveSide === 'home' ? gameResult.grubsAway : gameResult.grubsHome;
  const ownSoulCount = gameResult.dragonSoul.dragonTypes.filter((dragon) => dragon.side === perspectiveSide).length;
  const enemySoulCount = gameResult.dragonSoul.dragonTypes.filter((dragon) => dragon.side !== perspectiveSide).length;
  const ownBarons = gameResult.events.filter((event) => event.type === 'baron' && event.side === perspectiveSide).length;
  const enemyBarons = gameResult.events.filter((event) => event.type === 'baron' && event.side !== perspectiveSide).length;
  const ownHeralds = gameResult.events.filter((event) => event.type === 'rift_herald' && event.side === perspectiveSide).length;
  const enemyHeralds = gameResult.events.filter((event) => event.type === 'rift_herald' && event.side !== perspectiveSide).length;
  const ownTeam = sumTeamKda(ownStats);
  const enemyTeam = sumTeamKda(enemyStats);
  const reasons: MatchInsightReason[] = [];

  const earlyDiff = perspectiveSide === 'home'
    ? gameResult.goldDiffAt15
    : -gameResult.goldDiffAt15;
  if (Math.abs(earlyDiff) >= 1800) {
    const lostEarly = earlyDiff < 0;
    reasons.push({
      title: lostEarly ? '초반 주도권을 놓쳤습니다' : '초반 우위가 승리로 연결됐습니다',
      summary: lostEarly
        ? `15분 기준 골드가 ${Math.abs(earlyDiff)} 뒤처졌습니다. 라인전 압박과 초반 로테이션에서 밀리며 상대에게 스노우볼이 넘어갔습니다.`
        : `15분 기준 ${earlyDiff} 골드 우위를 만들어냈습니다. 라인전 압박을 템포로 전환해 이후 경기 흐름을 가져왔습니다.`,
      impact: impactFromValue(Math.min(Math.abs(earlyDiff) / 3500, 1)),
      nextAction: lostEarly ? '훈련 조정' : '전술 재검토',
    });
  }

  const towerDiff = ownTowers - enemyTowers;
  if (Math.abs(towerDiff) >= 3) {
    const lostMap = towerDiff < 0;
    reasons.push({
      title: lostMap ? '맵 장악이 흔들렸습니다' : '맵 압박을 유지했습니다',
      summary: lostMap
        ? `포탑 경쟁에서 ${ownTowers}-${enemyTowers}로 뒤졌습니다. 라인 배치가 불안정하거나 사이드 라인 방어가 부족했을 가능성이 높습니다.`
        : `포탑 경쟁에서 ${ownTowers}-${enemyTowers}로 앞섰습니다. 중립 오브젝트 진입과 사이드 라인 압박을 유리하게 가져갔습니다.`,
      impact: impactFromValue(Math.min(Math.abs(towerDiff) / 6, 1)),
      nextAction: lostMap ? '전술 재검토' : '드래프트 우선순위 재점검',
    });
  }

  const objectiveDiff = (ownSoulCount + ownBarons * 2 + ownHeralds + ownGrubs * 0.25)
    - (enemySoulCount + enemyBarons * 2 + enemyHeralds + enemyGrubs * 0.25);
  if (Math.abs(objectiveDiff) >= 1.5) {
    const lostObjectives = objectiveDiff < 0;
    reasons.push({
      title: lostObjectives ? '중립 오브젝트 싸움에서 밀렸습니다' : '오브젝트 장악이 승리를 만들었습니다',
      summary: lostObjectives
        ? '상대가 드래곤, 전령, 바론, 공허 유충을 더 많이 확보했습니다. 주요 오브젝트 주변 셋업에서 밀리며 게임 운영이 불리해졌습니다.'
        : '팀이 핵심 중립 오브젝트를 먼저 가져갔습니다. 이를 발판으로 가장 깔끔하게 게임을 마무리할 수 있었습니다.',
      impact: impactFromValue(Math.min(Math.abs(objectiveDiff) / 4, 1)),
      nextAction: lostObjectives ? '드래프트 우선순위 재점검' : '전술 재검토',
    });
  }

  const killDiff = ownKills - enemyKills;
  const damageDiff = ownTeam.damage - enemyTeam.damage;
  if (Math.abs(killDiff) >= 5 || Math.abs(damageDiff) >= 9000) {
    const lostFights = killDiff < 0 || damageDiff < 0;
    reasons.push({
      title: lostFights ? '한타에서 상대에게 눌렸습니다' : '한타 수행력이 좋았습니다',
      summary: lostFights
        ? `킬 스코어 ${ownKills}-${enemyKills}, 총 딜량 ${Math.abs(damageDiff)} 차이로 뒤졌습니다. 교전 실행력, 포지셔닝, 또는 진입 타이밍 문제가 있을 수 있습니다.`
        : `킬 스코어 ${ownKills}-${enemyKills}, 총 딜량 ${damageDiff} 앞섰습니다. 교전 실행력이 안정적으로 유지됐습니다.`,
      impact: impactFromValue(Math.min(Math.max(Math.abs(killDiff) / 12, Math.abs(damageDiff) / 15000), 1)),
      nextAction: lostFights ? '훈련 조정' : '전술 재검토',
    });
  }

  const worstOwnDeaths = [...ownStats].sort((left, right) => right.deaths - left.deaths)[0];
  if (worstOwnDeaths && worstOwnDeaths.deaths >= 5) {
    reasons.push({
      title: '특정 포지션이 집중 압박을 받았습니다',
      summary: `${worstOwnDeaths.position.toUpperCase()}이(가) ${worstOwnDeaths.deaths}번 죽었습니다. 매치업 열세, 보호 부족, 또는 라인업 구성 문제일 수 있습니다.`,
      impact: impactFromValue(Math.min(worstOwnDeaths.deaths / 8, 1)),
      nextAction: worstOwnDeaths.deaths >= 7 ? '로스터 변경 검토' : '선수 컨디션 관리',
    });
  }

  if (reasons.length < 3) {
    const finalGoldDiff = ownGold - enemyGold;
    reasons.push({
      title: isPerspectiveWin ? '마무리 운영이 안정적이었습니다' : '후반까지 박빙 흐름이 이어졌습니다',
      summary: isPerspectiveWin
        ? `최종 ${finalGoldDiff} 골드 우위로 마무리했습니다. 팀이 압박을 결과로 전환할 만큼 충분히 구조를 유지했습니다.`
        : `최종 골드 격차는 ${Math.abs(finalGoldDiff)}였습니다. 중후반 의사결정이 더 나았다면 결과를 뒤집을 여지가 있었습니다.`,
      impact: impactFromValue(Math.min(Math.abs(finalGoldDiff) / 6000, 1)),
      nextAction: isPerspectiveWin ? '전술 재검토' : '선수 컨디션 관리',
    });
  }

  const trimmedReasons = reasons
    .sort((left, right) => {
      const order = { high: 3, medium: 2, low: 1 };
      return order[right.impact] - order[left.impact];
    })
    .slice(0, 5);

  return {
    headline: isPerspectiveWin ? '준비가 결과로 이어졌습니다.' : '이번 결과에서 개선할 수 있는 약점이 드러났습니다.',
    outcomeLabel: isPerspectiveWin ? '잘 된 부분' : '아쉬운 부분',
    reasons: trimmedReasons,
    recommendedActions: dedupeActions(trimmedReasons),
  };
}
