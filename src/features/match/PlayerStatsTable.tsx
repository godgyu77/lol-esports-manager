/**
 * 실시간 선수 스탯 테이블 (OP.GG / LCK 방송 스타일)
 * - 5v5 선수별 KDA, CS, 골드, 데미지, KP%, GPM 실시간 표시
 */

import type { LivePlayerStat } from '../../engine/match/liveMatch';

const POS_LABELS: Record<string, string> = {
  top: 'TOP', jungle: 'JGL', mid: 'MID', adc: 'ADC', support: 'SUP',
};

function formatGold(gold: number): string {
  if (gold >= 1000) return `${(gold / 1000).toFixed(1)}k`;
  return `${gold}`;
}

function formatKda(k: number, d: number, a: number): string {
  if (d === 0) return 'Perfect';
  return ((k + a) / d).toFixed(1);
}

interface PlayerStatsTableProps {
  playerStatsHome: LivePlayerStat[];
  playerStatsAway: LivePlayerStat[];
  currentTick: number;
  killsHome: number;
  killsAway: number;
  homeTeamName?: string;
  awayTeamName?: string;
}

export function PlayerStatsTable({
  playerStatsHome,
  playerStatsAway,
  currentTick,
  killsHome,
  killsAway,
  homeTeamName = 'Blue',
  awayTeamName = 'Red',
}: PlayerStatsTableProps) {
  const tickMin = Math.max(1, currentTick);

  const renderRow = (stat: LivePlayerStat, side: 'home' | 'away', teamKills: number) => {
    const kda = formatKda(stat.kills, stat.deaths, stat.assists);
    const csPerMin = (stat.cs / tickMin).toFixed(1);
    const gpm = Math.round(stat.goldEarned / tickMin);
    const kp = teamKills > 0 ? Math.round(((stat.kills + stat.assists) / teamKills) * 100) : 0;
    const isMvpCandidate = stat.kills >= 3 && stat.deaths <= 1;

    return (
      <tr
        key={stat.playerId}
        className={`pst-row pst-row--${side} ${isMvpCandidate ? 'pst-row--mvp' : ''}`}
      >
        <td className="pst-pos">{POS_LABELS[stat.position] ?? stat.position}</td>
        <td className="pst-kda">
          <span className="pst-k">{stat.kills}</span>
          <span className="pst-slash">/</span>
          <span className="pst-d">{stat.deaths}</span>
          <span className="pst-slash">/</span>
          <span className="pst-a">{stat.assists}</span>
        </td>
        <td className="pst-kda-ratio">{kda}</td>
        <td className="pst-kp">{kp}%</td>
        <td className="pst-cs">{stat.cs} <span className="pst-cs-min">({csPerMin}/m)</span></td>
        <td className="pst-gold">{formatGold(stat.goldEarned)} <span className="pst-cs-min">({gpm}/m)</span></td>
        <td className="pst-dmg">{formatGold(stat.damageDealt)}</td>
      </tr>
    );
  };

  return (
    <div className="pst-container">
      <div className="pst-team">
        <div className="pst-team-header pst-team-header--home">{homeTeamName}</div>
        <table className="pst-table">
          <thead>
            <tr>
              <th>POS</th><th>K/D/A</th><th>KDA</th><th>KP%</th><th>CS</th><th>Gold</th><th>DMG</th>
            </tr>
          </thead>
          <tbody>
            {playerStatsHome.map(s => renderRow(s, 'home', killsHome))}
          </tbody>
        </table>
      </div>

      <div className="pst-team">
        <div className="pst-team-header pst-team-header--away">{awayTeamName}</div>
        <table className="pst-table">
          <thead>
            <tr>
              <th>POS</th><th>K/D/A</th><th>KDA</th><th>KP%</th><th>CS</th><th>Gold</th><th>DMG</th>
            </tr>
          </thead>
          <tbody>
            {playerStatsAway.map(s => renderRow(s, 'away', killsAway))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
