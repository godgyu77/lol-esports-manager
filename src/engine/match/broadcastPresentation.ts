import type { PostMatchComment } from '../../ai/gameAiService';
import { CHAMPION_DB } from '../../data/championDb';
import type {
  BroadcastCrew,
  BroadcastEventKind,
  BroadcastTalent,
  MatchBroadcastTier,
} from '../../data/broadcastTalentDb';
import { getDisplayEntityName, localizeEntityNamesInText } from '../../utils/displayName';
import type { ChampionTag } from '../../types/champion';
import type { Commentary, LiveGameState, LivePlayerStat } from './liveMatch';
import { buildBroadcastMatchContext, resolveBroadcastMatchTier, type BroadcastMatchContext } from './broadcastContext';
import type { DraftState, TeamDraftState } from '../draft/draftEngine';

export interface BroadcastLine {
  id: string;
  speaker: BroadcastTalent;
  roleLabel: string;
  tone: 'play' | 'analysis' | 'player' | 'studio' | 'alert';
  tickLabel: string;
  message: string;
  highlight?: boolean;
}

export interface BroadcastHighlight {
  title: string;
  detail: string;
  tone: 'neutral' | 'good' | 'danger';
}

export type CoachInterviewTone = 'calm' | 'confident' | 'reflective';

export interface InterviewToneOption {
  tone: CoachInterviewTone;
  label: string;
  answer: string;
}

export interface PostMatchInterviewPackage {
  openingHeadline: string;
  draftWrapUp: string;
  announcerIntro: string;
  studioSummary: string;
  pomAnnouncement: string;
  pomName: string;
  pomTeamName: string;
  pomReason: string;
  pomInterviewQuestion: string;
  pomInterviewAnswer: string;
  coachQuestion: string;
  coachToneOptions: InterviewToneOption[];
  fanReaction: string;
  socialReaction: string;
  aftermathHeadline: string;
  guestSummary?: string | null;
  guestAnalystName?: string | null;
}

interface BroadcastPresentationOptions {
  matchType?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  currentGameNum?: number;
  draftResult?: DraftState | null;
  broadcastContext?: BroadcastMatchContext;
}

interface DraftTeamProfile {
  early: number;
  late: number;
  teamfight: number;
  splitPush: number;
  tags: Record<ChampionTag, number>;
  engageCount: number;
  pokeCount: number;
  jungleTempo: number;
  botPriority: number;
  sidePressure: number;
  keyStrength: string;
  riskPoint: string;
}

interface DraftAnalysisSummary {
  favoredSide: 'home' | 'away' | 'even';
  earlySide: 'home' | 'away' | 'even';
  lateSide: 'home' | 'away' | 'even';
  teamfightSide: 'home' | 'away' | 'even';
  jungleSide: 'home' | 'away' | 'even';
  botSide: 'home' | 'away' | 'even';
  sideLaneSide: 'home' | 'away' | 'even';
  homeProfile: DraftTeamProfile;
  awayProfile: DraftTeamProfile;
  favoredReason: string;
}

function toRoleLabel(speaker: BroadcastTalent) {
  if (speaker.role === 'caster') return '캐스터';
  if (speaker.role === 'announcer') return '아나운서';
  if (speaker.role === 'guest_analyst') return '객원 해설';
  if (speaker.role === 'desk_analyst') return '분석데스크';
  return '해설';
}

function formatTickLabel(tick: number) {
  return `${tick.toString().padStart(2, '0')}:00`;
}

function commentaryTone(type?: string): BroadcastLine['tone'] {
  if (type === 'kill' || type === 'teamfight') return 'play';
  if (type === 'objective') return 'alert';
  if (type === 'highlight') return 'studio';
  return 'analysis';
}

function normalizeEventKind(type?: string, message?: string): BroadcastEventKind {
  const normalized = (type ?? 'default') as BroadcastEventKind;
  if (['kill', 'objective', 'teamfight', 'decision', 'highlight'].includes(normalized)) return normalized;
  const lowered = (message ?? '').toLowerCase();
  if (lowered.includes('baron')) return 'baron';
  if (lowered.includes('elder')) return 'elder';
  if (lowered.includes('nexus')) return 'nexus';
  return 'default';
}

function choose<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length]!;
}

function speakerSeed(entry: Commentary, speaker: BroadcastTalent, salt: number) {
  return entry.tick + speaker.id.length + salt;
}

function narrativeLabel(context: BroadcastMatchContext, side: 'home' | 'away', fallbackName?: string) {
  const narrative = side === 'home' ? context.homeNarrative : context.awayNarrative;
  if (!narrative) return fallbackName ?? (side === 'home' ? '홈팀' : '원정팀');
  return narrative.broadcastAlias;
}

function narrativeTeamName(context: BroadcastMatchContext, side: 'home' | 'away', fallbackName?: string) {
  const narrative = side === 'home' ? context.homeNarrative : context.awayNarrative;
  if (!narrative) return fallbackName ?? (side === 'home' ? '홈팀' : '원정팀');
  return narrative.teamName;
}

function leadingSide(gameState: LiveGameState): 'home' | 'away' {
  return gameState.goldHome >= gameState.goldAway ? 'home' : 'away';
}

function playerImpactScore(player: LivePlayerStat) {
  return player.kills * 4 + player.assists * 2 + player.damageDealt / 1500 + player.goldEarned / 1200 - player.deaths * 1.5;
}

function winningCorePlayer(gameState: LiveGameState, side: 'home' | 'away') {
  const pool = side === 'home' ? gameState.playerStatsHome : gameState.playerStatsAway;
  const best = [...pool].sort((a, b) => playerImpactScore(b) - playerImpactScore(a))[0];
  return best ? getDisplayEntityName(best.playerName) : null;
}

function buildNarrativeContextTag(context: BroadcastMatchContext, gameState: LiveGameState, homeTeamName?: string, awayTeamName?: string) {
  const side = leadingSide(gameState);
  const teamName = narrativeTeamName(context, side, side === 'home' ? homeTeamName : awayTeamName);
  const alias = narrativeLabel(context, side, teamName);
  const playerName = winningCorePlayer(gameState, side);
  if (playerName) return `${teamName}의 ${alias} 흐름에서 ${playerName}가 중심을 잡고 있습니다.`;
  return `${teamName}의 ${alias} 리듬이 경기 흐름을 쥐고 있습니다.`;
}

function casterMessage(
  speaker: BroadcastTalent,
  eventKind: BroadcastEventKind,
  localized: string,
  entry: Commentary,
  context: BroadcastMatchContext,
  gameState: LiveGameState,
  homeTeamName?: string,
  awayTeamName?: string,
) {
  const seed = speakerSeed(entry, speaker, 3);
  const tag = buildNarrativeContextTag(context, gameState, homeTeamName, awayTeamName);
  const bigMatchLine = context.matchTier !== 'regular' ? choose(speaker.bigMatchOnlyLines[eventKind] ?? speaker.signaturePhrases, seed) : null;

  if (speaker.id === 'jun-yongjun') {
    if (eventKind === 'teamfight' || eventKind === 'highlight') {
      return `${bigMatchLine ?? '한 장면이 경기의 방향을 흔듭니다!'} ${localized} ${tag}`;
    }
    if (eventKind === 'baron' || eventKind === 'elder' || eventKind === 'nexus' || eventKind === 'game_end') {
      return `${bigMatchLine ?? '이제는 한 번의 판단이 승부를 가릅니다!'} ${localized}`;
    }
    return `${choose(speaker.signaturePhrases, seed)} ${localized}`;
  }

  if (speaker.id === 'seong-seunghun') {
    if (eventKind === 'kill') return `${choose(speaker.signaturePhrases, seed)} ${localized}`;
    if (eventKind === 'objective') return `${localized} 여기서 템포가 확 올라갑니다!`;
    return `${bigMatchLine ?? choose(speaker.signaturePhrases, seed)} ${localized}`;
  }

  return `${choose(speaker.signaturePhrases, seed)} ${localized}`;
}

function goldLeadText(gameState: LiveGameState) {
  const goldDiff = gameState.goldHome - gameState.goldAway;
  if (goldDiff === 0) return '양 팀 골드 차이는 크지 않습니다.';
  const ahead = goldDiff > 0 ? '홈팀' : '원정팀';
  return `${ahead}이 ${(Math.abs(goldDiff) / 1000).toFixed(1)}k 정도 앞서 있습니다.`;
}

function analystMessage(
  speaker: BroadcastTalent,
  eventKind: BroadcastEventKind,
  localized: string,
  entry: Commentary,
  gameState: LiveGameState,
  context: BroadcastMatchContext,
  homeTeamName?: string,
  awayTeamName?: string,
) {
  const seed = speakerSeed(entry, speaker, 11);
  const tag = buildNarrativeContextTag(context, gameState, homeTeamName, awayTeamName);

  if (speaker.id === 'lee-hyeonwoo-clem') {
    if (eventKind === 'teamfight') return `${choose(speaker.signaturePhrases, seed)} ${localized} 이건 준비한 구도가 제대로 열린 한타입니다. ${tag}`;
    if (eventKind === 'objective' || eventKind === 'decision') return `${localized} ${goldLeadText(gameState)} 먼저 자리를 먹은 쪽의 준비도가 좋았습니다.`;
    return `${localized} 방금 장면은 직전 운영의 결과가 그대로 이어진 겁니다.`;
  }

  if (speaker.id === 'lim-juwan-pony') {
    return `${localized} 데이터와 구도 관점에서 보면 지금 판단이 꽤 명확합니다. ${goldLeadText(gameState)}`;
  }

  if (speaker.id === 'lee-chaehwan-prince') {
    return `${localized} 바텀과 후반 캐리 각도까지 보면 지금 장면의 가치가 더 큽니다.`;
  }

  if (speaker.id === 'eom-seonghyeon-umti') {
    return `${localized} 정글 동선과 합류 속도 차이가 여기서 드러납니다.`;
  }

  return `${localized} ${choose(speaker.signaturePhrases, seed)}`;
}

function guestMessage(
  speaker: BroadcastTalent,
  eventKind: BroadcastEventKind,
  localized: string,
  entry: Commentary,
  context: BroadcastMatchContext,
  gameState: LiveGameState,
  homeTeamName?: string,
  awayTeamName?: string,
) {
  const seed = speakerSeed(entry, speaker, 19);
  const tag = buildNarrativeContextTag(context, gameState, homeTeamName, awayTeamName);

  if (speaker.id === 'han-wangho-peanut') {
    return `${localized} 정글 시점에서는 이 콜이 먼저 보입니다. ${tag}`;
  }
  if (speaker.id === 'lee-seohaeng-kuro') {
    return `${localized} 미드 주도권이 먼저 연결됐기 때문에 가능한 장면이었습니다.`;
  }
  if (speaker.id === 'gang-beomhyeon-gorilla') {
    return `${localized} 시야와 합류 타이밍이 완전히 맞아떨어졌습니다.`;
  }
  if (speaker.id === 'kim-dongha-khan') {
    return `${choose(speaker.signaturePhrases, seed)} ${localized}`;
  }

  return `${choose(speaker.signaturePhrases, seed)} ${localized}`;
}

function buildNarrativeOpeningLines(
  crew: BroadcastCrew,
  context: BroadcastMatchContext,
  currentGameNum: number | undefined,
  homeTeamName?: string,
  awayTeamName?: string,
): BroadcastLine[] {
  const homeAlias = narrativeLabel(context, 'home', homeTeamName);
  const awayAlias = narrativeLabel(context, 'away', awayTeamName);
  const opening =
    context.matchTier === 'finals'
      ? `${homeAlias}와 ${awayAlias}, 결승 ${currentGameNum ?? 1}세트입니다. ${context.rivalryContext?.hook ?? '오늘 무대의 모든 무게가 이 한 경기로 모입니다.'}`
      : context.matchTier === 'playoffs'
        ? `${homeAlias}와 ${awayAlias}, 플레이오프 ${currentGameNum ?? 1}세트입니다. ${context.rivalryContext?.openingNarrative ?? '시리즈의 방향을 가를 시간이 다가왔습니다.'}`
        : `${homeAlias}와 ${awayAlias}, ${currentGameNum ?? 1}세트 시작입니다. ${context.rivalryContext?.hook ?? '양 팀의 색이 어떻게 부딪히는지 바로 확인해보겠습니다.'}`;
  const analystIntro =
    context.matchTier === 'finals'
      ? `${crew.analystPrimary.name} 해설은 "${context.homeNarrative?.bigMatchNarrative ?? homeAlias}와 ${context.awayNarrative?.bigMatchNarrative ?? awayAlias}가 맞붙는 결승이라 한 장면의 가치가 더 크다"고 짚었습니다.`
      : `${crew.analystPrimary.name} 해설은 "${context.homeNarrative?.playPatternNarrative ?? homeAlias}와 ${context.awayNarrative?.playPatternNarrative ?? awayAlias}의 충돌이 오늘 핵심"이라고 분석했습니다.`;

  return [
    {
      id: `opening-caster-${currentGameNum ?? 1}`,
      speaker: crew.caster,
      roleLabel: toRoleLabel(crew.caster),
      tone: 'studio',
      tickLabel: 'LIVE',
      message: opening,
      highlight: true,
    },
    {
      id: `opening-analyst-${currentGameNum ?? 1}`,
      speaker: crew.analystPrimary,
      roleLabel: toRoleLabel(crew.analystPrimary),
      tone: 'analysis',
      tickLabel: 'LIVE',
      message: analystIntro,
    },
  ];
}

function buildNarrativeDraftWrapUpLine(
  crew: BroadcastCrew,
  context: BroadcastMatchContext,
  homeTeamName?: string,
  awayTeamName?: string,
): BroadcastLine {
  const speaker = crew.guestAnalyst ?? crew.analystSecondary;
  const homeAlias = narrativeLabel(context, 'home', homeTeamName);
  const awayAlias = narrativeLabel(context, 'away', awayTeamName);
  const text =
    context.matchTier === 'finals'
      ? `${speaker.name} ${toRoleLabel(speaker)}은 "${homeAlias}와 ${awayAlias} 모두 큰 경기답게 준비한 카드가 보입니다. 밴픽부터 시리즈 압박감이 강하게 느껴집니다."라고 정리했습니다.`
      : `${speaker.name} ${toRoleLabel(speaker)}은 "${homeAlias}의 색과 ${awayAlias}의 흐름이 밴픽에서부터 드러났습니다."라고 분석했습니다.`;
  return {
    id: `draft-wrap-up-${homeTeamName ?? 'home'}-${awayTeamName ?? 'away'}`,
    speaker,
    roleLabel: toRoleLabel(speaker),
    tone: 'studio',
    tickLabel: 'DRAFT',
    message: text,
  };
}

function createTagCounter(): Record<ChampionTag, number> {
  return {
    assassin: 0,
    fighter: 0,
    mage: 0,
    marksman: 0,
    support: 0,
    tank: 0,
    engage: 0,
    poke: 0,
    splitpush: 0,
    teamfight: 0,
    utility: 0,
    hypercarry: 0,
  };
}

function resolveDraftStrengthLabel(profile: DraftTeamProfile) {
  const ranked = [
    { key: 'engageTeamfight', score: profile.tags.engage + profile.tags.teamfight, label: '정면 한타와 개시 구도' },
    { key: 'pokeUtility', score: profile.tags.poke + profile.tags.utility, label: '견제와 오브젝트 사전 장악' },
    { key: 'split', score: profile.tags.splitpush + profile.splitPush / 30, label: '사이드 운영과 압박 분산' },
    { key: 'lateCarry', score: profile.tags.hypercarry + profile.late / 35, label: '후반 캐리력과 딜링 기대치' },
    { key: 'pick', score: profile.tags.assassin + profile.early / 35, label: '초반 변수와 픽 메이킹' },
  ].sort((left, right) => right.score - left.score);
  return ranked[0]?.label ?? '무난한 밸런스 조합';
}

function resolveDraftRiskLabel(profile: DraftTeamProfile) {
  if (profile.tags.assassin >= 2 && profile.tags.tank === 0) return '진입 타이밍이 어긋나면 조합 가치가 급격히 떨어질 수 있습니다.';
  if (profile.tags.hypercarry >= 1 && profile.early < 250) return '초반 라인전 압박을 버티기 전까지 시간이 필요합니다.';
  if (profile.tags.splitpush >= 2) return '사이드 운영이 막히면 중앙 교전에서 답답해질 수 있습니다.';
  if (profile.tags.engage === 0 && profile.tags.poke === 0) return '확실한 교전 개시 각을 직접 만들어야 하는 숙제가 남습니다.';
  return '큰 실수만 줄이면 조합 장점을 살리기 좋은 구도입니다.';
}

function analyzeTeamDraft(teamDraft: TeamDraftState | undefined): DraftTeamProfile {
  const base: DraftTeamProfile = {
    early: 0,
    late: 0,
    teamfight: 0,
    splitPush: 0,
    tags: createTagCounter(),
    engageCount: 0,
    pokeCount: 0,
    jungleTempo: 0,
    botPriority: 0,
    sidePressure: 0,
    keyStrength: '무난한 밸런스 조합',
    riskPoint: '큰 실수만 줄이면 조합 장점을 살리기 좋은 구도입니다.',
  };

  if (!teamDraft || teamDraft.picks.length === 0) return base;

  for (const pick of teamDraft.picks) {
    const champion = CHAMPION_DB.find((entry) => entry.id === pick.championId);
    if (!champion) continue;
    base.early += champion.stats.earlyGame;
    base.late += champion.stats.lateGame;
      base.teamfight += champion.stats.teamfight;
      base.splitPush += champion.stats.splitPush;
      if (champion.tags.includes('engage')) base.engageCount += 1;
      if (champion.tags.includes('poke')) base.pokeCount += 1;
      if (pick.position === 'jungle') {
        base.jungleTempo += champion.stats.earlyGame + (champion.tags.includes('engage') ? 12 : 0) + (champion.tags.includes('assassin') ? 8 : 0);
      }
      if (pick.position === 'adc' || pick.position === 'support') {
        base.botPriority += champion.stats.earlyGame + (champion.tags.includes('poke') ? 10 : 0) + (champion.tags.includes('marksman') ? 8 : 0) + (champion.tags.includes('engage') ? 8 : 0);
      }
      if (pick.position === 'top' || pick.position === 'mid') {
        base.sidePressure += champion.stats.splitPush + (champion.tags.includes('splitpush') ? 14 : 0) + (champion.tags.includes('assassin') ? 8 : 0);
      }
      champion.tags.forEach((tag) => {
        base.tags[tag] += 1;
      });
  }

  base.keyStrength = resolveDraftStrengthLabel(base);
  base.riskPoint = resolveDraftRiskLabel(base);
  return base;
}

function compareAxis(homeValue: number, awayValue: number, threshold = 18): 'home' | 'away' | 'even' {
  if (Math.abs(homeValue - awayValue) <= threshold) return 'even';
  return homeValue > awayValue ? 'home' : 'away';
}

function buildDraftAnalysisSummary(draftResult: DraftState | null | undefined): DraftAnalysisSummary | null {
  if (!draftResult) return null;

  const homeProfile = analyzeTeamDraft(draftResult.blue);
  const awayProfile = analyzeTeamDraft(draftResult.red);
  const earlySide = compareAxis(homeProfile.early, awayProfile.early);
  const lateSide = compareAxis(homeProfile.late, awayProfile.late);
  const teamfightSide = compareAxis(homeProfile.teamfight, awayProfile.teamfight);
  const jungleSide = compareAxis(homeProfile.jungleTempo, awayProfile.jungleTempo, 10);
  const botSide = compareAxis(homeProfile.botPriority, awayProfile.botPriority, 14);
  const sideLaneSide = compareAxis(homeProfile.sidePressure, awayProfile.sidePressure, 14);

  const homeScore =
    homeProfile.early * 0.35 +
    homeProfile.late * 0.2 +
    homeProfile.teamfight * 0.3 +
    homeProfile.tags.engage * 18 +
    homeProfile.tags.utility * 10 +
    homeProfile.tags.hypercarry * 8;
  const awayScore =
    awayProfile.early * 0.35 +
    awayProfile.late * 0.2 +
    awayProfile.teamfight * 0.3 +
    awayProfile.tags.engage * 18 +
    awayProfile.tags.utility * 10 +
    awayProfile.tags.hypercarry * 8;

  const favoredSide = compareAxis(homeScore, awayScore, 35);
  const favoredReason =
    favoredSide === 'home'
      ? `홈 조합은 ${homeProfile.keyStrength} 쪽 완성도가 더 뚜렷합니다.`
      : favoredSide === 'away'
        ? `원정 조합은 ${awayProfile.keyStrength} 쪽 그림이 더 선명합니다.`
        : '양쪽 모두 다른 승리 조건을 잡은 밴픽이라 어느 한쪽으로 단정하기 어렵습니다.';

  return {
    favoredSide,
    earlySide,
    lateSide,
    teamfightSide,
    jungleSide,
    botSide,
    sideLaneSide,
    homeProfile,
    awayProfile,
    favoredReason,
  };
}

function sideDisplay(side: 'home' | 'away', homeTeamName?: string, awayTeamName?: string) {
  return side === 'home' ? (homeTeamName ?? '홈팀') : (awayTeamName ?? '원정팀');
}

function axisAdvantageText(axis: 'early' | 'late' | 'teamfight', side: 'home' | 'away' | 'even', homeTeamName?: string, awayTeamName?: string) {
  const axisLabel =
    axis === 'early' ? '초반 주도권' : axis === 'late' ? '후반 캐리력' : '정면 한타';
  if (side === 'even') return `${axisLabel}은 크게 갈리지 않습니다.`;
  return `${axisLabel}은 ${sideDisplay(side, homeTeamName, awayTeamName)} 쪽이 조금 더 편해 보입니다.`;
}

function contextualDraftDetail(summary: DraftAnalysisSummary, homeTeamName?: string, awayTeamName?: string) {
  const details: string[] = [];

  if (summary.botSide !== 'even') {
    details.push(`바텀 주도권은 ${sideDisplay(summary.botSide, homeTeamName, awayTeamName)} 쪽이 먼저 잡을 가능성이 있습니다.`);
  }
  if (summary.jungleSide !== 'even') {
    details.push(`정글 첫 동선과 합류 속도는 ${sideDisplay(summary.jungleSide, homeTeamName, awayTeamName)} 쪽이 더 편합니다.`);
  }
  if (summary.sideLaneSide !== 'even') {
    details.push(`사이드 운영 압박은 ${sideDisplay(summary.sideLaneSide, homeTeamName, awayTeamName)} 쪽이 더 강하게 걸 수 있습니다.`);
  }
  if (summary.homeProfile.engageCount !== summary.awayProfile.engageCount) {
    const side = summary.homeProfile.engageCount > summary.awayProfile.engageCount ? 'home' : 'away';
    details.push(`${sideDisplay(side, homeTeamName, awayTeamName)} 쪽이 교전 개시 버튼을 더 안정적으로 가지고 있습니다.`);
  }

  return details.slice(0, 2).join(' ');
}

function speakerSpecializedDraftAngle(
  speaker: BroadcastTalent,
  summary: DraftAnalysisSummary,
  homeTeamName?: string,
  awayTeamName?: string,
) {
  switch (speaker.id) {
    case 'eom-seonghyeon-umti':
    case 'han-wangho-peanut':
      return summary.jungleSide === 'even'
        ? '정글 입장에서는 첫 동선과 첫 전령 타이밍이 사실상 승부처입니다.'
        : `정글 설계는 ${sideDisplay(summary.jungleSide, homeTeamName, awayTeamName)} 쪽이 먼저 주도권을 잡기 편합니다. 첫 동선과 첫 전령 타이밍이 중요합니다.`;
    case 'lee-chaehwan-prince':
    case 'gang-hyeongu-cptjack':
    case 'gang-beomhyeon-gorilla':
    case 'hong-mingi-madlife':
    case 'lee-jaewan-wolf':
      return summary.botSide === 'even'
        ? '바텀은 크게 기울지 않았지만 첫 웨이브와 용 타이밍 주도권이 승부를 가를 수 있습니다.'
        : `바텀 구도는 ${sideDisplay(summary.botSide, homeTeamName, awayTeamName)} 쪽이 먼저 라인 주도권을 잡을 가능성이 높습니다. 첫 용 연결이 중요합니다.`;
    case 'kim-dongha-khan':
    case 'song-gyeongho-smeb':
    case 'lee-hojong-flame':
      return summary.sideLaneSide === 'even'
        ? '탑 상성은 한 번의 실수로도 흐름이 크게 흔들릴 수 있는 구도입니다.'
        : `사이드와 탑 구도는 ${sideDisplay(summary.sideLaneSide, homeTeamName, awayTeamName)} 쪽이 더 세게 압박할 수 있습니다.`;
    case 'lee-seohaeng-kuro':
      return summary.sideLaneSide === 'even'
        ? '미드 주도권과 오브젝트 연결만 누가 먼저 잡느냐가 핵심입니다.'
        : `${sideDisplay(summary.sideLaneSide, homeTeamName, awayTeamName)} 쪽이 미드-사이드 연결을 더 매끄럽게 만들 가능성이 있습니다.`;
    case 'lim-juwan-pony':
      return `${axisAdvantageText('early', summary.earlySide, homeTeamName, awayTeamName)} ${axisAdvantageText('late', summary.lateSide, homeTeamName, awayTeamName)}`;
    case 'lee-hyeonwoo-clem':
      return `${axisAdvantageText('teamfight', summary.teamfightSide, homeTeamName, awayTeamName)} 결국 누가 먼저 구도를 열어 주느냐가 핵심입니다.`;
    default:
      return contextualDraftDetail(summary, homeTeamName, awayTeamName);
  }
}

function buildDraftAnalysisLines(
  crew: BroadcastCrew,
  context: BroadcastMatchContext,
  summary: DraftAnalysisSummary | null,
  homeTeamName?: string,
  awayTeamName?: string,
): BroadcastLine[] {
  if (!summary) {
    return [buildNarrativeDraftWrapUpLine(crew, context, homeTeamName, awayTeamName)];
  }

  const favored =
    summary.favoredSide === 'even'
      ? '밴픽 결과만 놓고 보면 완전히 오픈된 승부입니다.'
      : `${sideDisplay(summary.favoredSide, homeTeamName, awayTeamName)} 쪽이 밴픽 단계에서는 조금 더 웃고 있습니다.`;

  const casterLine: BroadcastLine = {
    id: `draft-caster-${homeTeamName ?? 'home'}-${awayTeamName ?? 'away'}`,
    speaker: crew.caster,
    roleLabel: toRoleLabel(crew.caster),
    tone: 'studio',
    tickLabel: 'DRAFT',
    message: `${buildNarrativeDraftWrapUpLine(crew, context, homeTeamName, awayTeamName).message} ${favored}`,
    highlight: true,
  };

  const analystPrimaryLine: BroadcastLine = {
    id: `draft-analyst-primary-${homeTeamName ?? 'home'}-${awayTeamName ?? 'away'}`,
    speaker: crew.analystPrimary,
    roleLabel: toRoleLabel(crew.analystPrimary),
    tone: 'analysis',
    tickLabel: 'DRAFT',
    message: `${summary.favoredReason} ${speakerSpecializedDraftAngle(crew.analystPrimary, summary, homeTeamName, awayTeamName)} ${contextualDraftDetail(summary, homeTeamName, awayTeamName)}`.trim(),
  };

  const secondarySpeaker = crew.guestAnalyst ?? crew.analystSecondary;
  const secondaryLine: BroadcastLine = {
    id: `draft-analyst-secondary-${homeTeamName ?? 'home'}-${awayTeamName ?? 'away'}`,
    speaker: secondarySpeaker,
    roleLabel: toRoleLabel(secondarySpeaker),
    tone: secondarySpeaker.role === 'guest_analyst' ? 'studio' : 'player',
      tickLabel: 'DRAFT',
      message:
        secondarySpeaker.role === 'guest_analyst'
        ? `${summary.homeProfile.keyStrength}을 노리는 ${homeTeamName ?? '홈팀'}과 ${summary.awayProfile.keyStrength}을 노리는 ${awayTeamName ?? '원정팀'}의 충돌입니다. ${speakerSpecializedDraftAngle(secondarySpeaker, summary, homeTeamName, awayTeamName)} 핵심 변수는 ${summary.homeProfile.riskPoint}`
        : `${axisAdvantageText('late', summary.lateSide, homeTeamName, awayTeamName)} ${speakerSpecializedDraftAngle(secondarySpeaker, summary, homeTeamName, awayTeamName)} ${homeTeamName ?? '홈팀'}은 ${summary.homeProfile.riskPoint} ${awayTeamName ?? '원정팀'}은 ${summary.awayProfile.riskPoint}`,
  };

  return [casterLine, analystPrimaryLine, secondaryLine];
}

export function buildBroadcastLines(
  commentary: Commentary[],
  crew: BroadcastCrew,
  gameState: LiveGameState,
  options?: BroadcastPresentationOptions,
): BroadcastLine[] {
  const context =
    options?.broadcastContext ??
    buildBroadcastMatchContext({
      homeTeamId: options?.homeTeamId,
      awayTeamId: options?.awayTeamId,
      matchType: options?.matchType,
    });
  const recent = commentary.slice(-18);
  const lines: BroadcastLine[] = [
    ...buildNarrativeOpeningLines(crew, context, options?.currentGameNum, options?.homeTeamName, options?.awayTeamName),
    ...buildDraftAnalysisLines(
      crew,
      context,
      buildDraftAnalysisSummary(options?.draftResult),
      options?.homeTeamName,
      options?.awayTeamName,
    ),
  ];

  recent.forEach((entry, index) => {
    const localized = localizeEntityNamesInText(entry.message);
    const eventKind = normalizeEventKind(entry.type, entry.message);

    lines.push({
      id: `caster-${entry.tick}-${index}`,
      speaker: crew.caster,
      roleLabel: toRoleLabel(crew.caster),
      tone: commentaryTone(entry.type),
      tickLabel: formatTickLabel(entry.tick),
      message: casterMessage(crew.caster, eventKind, localized, entry, context, gameState, options?.homeTeamName, options?.awayTeamName),
      highlight: entry.type === 'highlight' || entry.type === 'teamfight',
    });

    if (entry.type !== 'info') {
      const analyst = entry.type === 'objective' || entry.type === 'decision' ? crew.analystPrimary : crew.analystSecondary;
      lines.push({
        id: `analyst-${entry.tick}-${index}`,
        speaker: analyst,
        roleLabel: toRoleLabel(analyst),
        tone: analyst === crew.analystPrimary ? 'analysis' : 'player',
        tickLabel: formatTickLabel(entry.tick),
        message: analystMessage(analyst, eventKind, localized, entry, gameState, context, options?.homeTeamName, options?.awayTeamName),
      });
    }

    if (crew.guestAnalyst && ['objective', 'teamfight', 'highlight'].includes(entry.type)) {
      lines.push({
        id: `guest-${entry.tick}-${index}`,
        speaker: crew.guestAnalyst,
        roleLabel: toRoleLabel(crew.guestAnalyst),
        tone: 'studio',
        tickLabel: formatTickLabel(entry.tick),
        message: guestMessage(crew.guestAnalyst, eventKind, localized, entry, context, gameState, options?.homeTeamName, options?.awayTeamName),
        highlight: true,
      });
    }
  });

  return lines.slice(-28);
}

export function buildBroadcastHighlight(gameState: LiveGameState): BroadcastHighlight {
  if (!gameState.focusEvent) {
    return {
      title: '중계 대기',
      detail: '다음 주요 교전과 오브젝트 흐름을 추적하고 있습니다.',
      tone: 'neutral',
    };
  }

  return {
    title: localizeEntityNamesInText(gameState.focusEvent.label),
    detail: localizeEntityNamesInText(gameState.focusEvent.detail),
    tone:
      gameState.focusEvent.side === 'home'
        ? gameState.goldHome >= gameState.goldAway
          ? 'good'
          : 'danger'
        : gameState.goldAway >= gameState.goldHome
          ? 'good'
          : 'danger',
  };
}

export function determinePom(gameState: LiveGameState, homeTeamName: string, awayTeamName: string) {
  const winningSide = gameState.winner ?? (gameState.goldHome >= gameState.goldAway ? 'home' : 'away');
  const pool = winningSide === 'home' ? gameState.playerStatsHome : gameState.playerStatsAway;
  const best = [...pool].sort((a, b) => playerImpactScore(b) - playerImpactScore(a))[0] ?? pool[0];
  const teamName = winningSide === 'home' ? homeTeamName : awayTeamName;

  return {
    player: best,
    teamName,
    reason: `${getDisplayEntityName(best.playerName)} 선수가 ${best.kills}/${best.deaths}/${best.assists}, CS ${best.cs}, 피해량 ${Math.round(best.damageDealt).toLocaleString()}로 가장 강한 존재감을 남겼습니다.`,
  };
}

function buildPomAnswer(pomName: string, teamName: string) {
  return `${pomName} 선수는 "팀이 준비한 흐름대로 오브젝트 구간에서 먼저 자리를 잡을 수 있었고, 팀원들이 교전 집중력을 잘 맞춰줘서 좋은 결과가 나왔습니다"라고 말했습니다. ${teamName}의 오늘 승리는 개인 캐리뿐 아니라 팀 운영의 완성도가 함께 드러난 경기였습니다.`;
}

function buildCoachAnswer(teamName: string, opponentName: string, tone: CoachInterviewTone) {
  switch (tone) {
    case 'confident':
      return `${teamName} 감독은 "${opponentName} 상대로 우리가 준비한 운영 구도와 교전 설계가 분명했습니다. 선수들이 중요한 순간 흔들리지 않았고, 오늘 경기는 준비의 결과입니다"라고 자신 있게 말했습니다.`;
    case 'reflective':
      return `${teamName} 감독은 "좋은 장면도 있었지만 아직 보완할 운영 디테일이 있습니다. 다만 선수들이 중요한 순간 집중력을 보여준 점은 분명한 수확입니다"라고 차분하게 돌아봤습니다.`;
    default:
      return `${teamName} 감독은 "${opponentName}전은 준비가 많이 필요했던 경기였는데, 선수들이 계획한 움직임을 잘 지켜줬습니다. 다음 경기에서도 같은 집중력을 이어가겠습니다"라고 밝혔습니다.`;
  }
}

function announcerIntro(announcer: BroadcastTalent, winnerName: string, matchTier: MatchBroadcastTier) {
  if (announcer.id === 'yoon-subin') {
    return `${announcer.name} 아나운서입니다. ${matchTier === 'regular' ? '오늘 경기' : '이번 무대'}의 승자는 ${winnerName}입니다. 지금부터 경기 총평과 POM을 정리해드리겠습니다.`;
  }
  if (announcer.id === 'bae-hyeji') {
    return `${announcer.name} 아나운서입니다. 현장 분위기가 뜨거운데요, ${winnerName}의 승리로 끝난 오늘 경기를 바로 정리해보겠습니다.`;
  }
  return `${announcer.name} 아나운서입니다. 방금 경기의 결정적인 장면들을 중심으로 ${winnerName}의 승리를 정리해보겠습니다.`;
}

function buildNarrativeOpeningHeadline(context: BroadcastMatchContext, homeTeamName: string, awayTeamName: string) {
  const rivalryLead = context.rivalryContext?.headline;
  if (context.matchTier === 'finals') {
    return rivalryLead
      ? `${rivalryLead}: ${homeTeamName} vs ${awayTeamName}`
      : `${narrativeLabel(context, 'home', homeTeamName)} vs ${narrativeLabel(context, 'away', awayTeamName)}, 결승 중계 시작`;
  }
  if (context.matchTier === 'playoffs') {
    return rivalryLead
      ? `${rivalryLead}: ${homeTeamName} vs ${awayTeamName} 플레이오프`
      : `${narrativeLabel(context, 'home', homeTeamName)} vs ${narrativeLabel(context, 'away', awayTeamName)} 플레이오프 충돌`;
  }
  return rivalryLead
    ? `${rivalryLead}: ${homeTeamName} vs ${awayTeamName}`
    : `${narrativeLabel(context, 'home', homeTeamName)} vs ${narrativeLabel(context, 'away', awayTeamName)} 정규시즌 맞대결`;
}

function buildNarrativeDraftSummary(context: BroadcastMatchContext, homeTeamName: string, awayTeamName: string) {
  const homeLead = context.homeNarrative?.playPatternNarrative ?? `${homeTeamName}의 준비가 선명했습니다.`;
  const awayLead = context.awayNarrative?.playPatternNarrative ?? `${awayTeamName}도 쉽게 밀리지 않는 구도를 보여줬습니다.`;
  return `${homeLead} ${awayLead} ${context.rivalryContext?.openingNarrative ?? '밴픽 단계부터 두 팀의 색이 충돌하는 구도였습니다.'}`;
}

function buildNarrativeAftermath(context: BroadcastMatchContext, winningTeamName: string, losingTeamName: string) {
  if (context.isRivalry) {
    return `${winningTeamName}이 라이벌전 감정선을 가져갔고 ${losingTeamName}은 다음 맞대결에서 반드시 되갚아야 할 이유를 남겼습니다.`;
  }
  return `${winningTeamName}은 자기 팀 색을 더 선명하게 보여줬고 ${losingTeamName}은 다음 경기에서 보완해야 할 과제를 분명히 남겼습니다.`;
}

function buildNarrativeGuestDeskSummary(
  guest: BroadcastTalent | null | undefined,
  context: BroadcastMatchContext,
  userTeamName: string,
  opponentTeamName: string,
) {
  if (!guest) return null;
  const base = guest.deskSummaryStyle[0] ?? `${userTeamName}이 중요한 순간 더 단단했습니다.`;
  const rivalTag = context.rivalryContext?.closingNarrative ?? '';
  const bigMatchTag =
    context.matchTier === 'finals'
      ? '결승답게 준비한 서사를 끝까지 지켜낸 경기였습니다.'
      : context.matchTier === 'playoffs'
        ? '플레이오프답게 한 장면의 가치가 더 크게 느껴졌습니다.'
        : '';
  return `${guest.name} 객원 해설은 "${base} ${rivalTag} ${bigMatchTag} ${userTeamName}이 ${opponentTeamName}보다 중요한 순간 집중력에서 앞섰습니다."라고 총평했습니다.`;
}

function buildPomAnnouncement(announcer: BroadcastTalent, pomName: string, teamName: string, matchTier: MatchBroadcastTier) {
  if (announcer.id === 'yoon-subin') {
    return `${announcer.name} 아나운서가 발표합니다. 오늘 경기 POM은 ${teamName}의 ${pomName} 선수입니다.`;
  }
  if (announcer.id === 'bae-hyeji') {
    return `${announcer.name} 아나운서의 발표입니다. 오늘 가장 빛난 선수, ${teamName}의 ${pomName}입니다.`;
  }
  if (matchTier === 'finals') {
    return `${announcer.name} 아나운서가 전합니다. 결승 무대의 POM은 ${teamName}의 ${pomName} 선수입니다.`;
  }
  return `${announcer.name} 아나운서가 전합니다. 오늘 경기 POM은 ${teamName}의 ${pomName} 선수입니다.`;
}

export function buildPostMatchInterviewPackage(params: {
  crew: BroadcastCrew;
  gameState: LiveGameState;
  homeTeamId?: string;
  awayTeamId?: string;
  homeTeamName: string;
  awayTeamName: string;
  userTeamName: string;
  opponentTeamName: string;
  postMatchComment?: PostMatchComment | null;
  matchType?: string;
}): PostMatchInterviewPackage {
  const pom = determinePom(params.gameState, params.homeTeamName, params.awayTeamName);
  const pomName = getDisplayEntityName(pom.player.playerName);
  const context = buildBroadcastMatchContext({
    homeTeamId: params.homeTeamId,
    awayTeamId: params.awayTeamId,
    matchType: params.matchType,
  });
  const matchTier = resolveBroadcastMatchTier(params.matchType);
  const winningTeamName = params.gameState.winner === 'home' ? params.homeTeamName : params.awayTeamName;
  const losingTeamName = params.gameState.winner === 'home' ? params.awayTeamName : params.homeTeamName;
  const aftermathHeadline = params.postMatchComment?.headline ?? buildNarrativeAftermath(context, winningTeamName, losingTeamName);

  return {
    openingHeadline: buildNarrativeOpeningHeadline(context, params.homeTeamName, params.awayTeamName),
    draftWrapUp: buildNarrativeDraftSummary(context, params.homeTeamName, params.awayTeamName),
    announcerIntro: announcerIntro(params.crew.announcer, winningTeamName, matchTier),
    studioSummary:
      params.postMatchComment?.coachComment ??
      `${params.userTeamName}은 ${context.homeNarrative?.winNarrative ?? '오늘 준비한 색을 끝까지 밀어붙였습니다.'} ${params.opponentTeamName}은 ${context.awayNarrative?.lossNarrative ?? '다음 경기에서 보완해야 할 지점을 남겼습니다.'} ${context.rivalryContext?.closingNarrative ?? ''}`.trim(),
    pomAnnouncement: buildPomAnnouncement(params.crew.announcer, pomName, pom.teamName, matchTier),
    pomName,
    pomTeamName: pom.teamName,
    pomReason: pom.reason,
    pomInterviewQuestion: '오늘 경기에서 가장 결정적이었던 순간은 어떻게 느끼셨나요?',
    pomInterviewAnswer: buildPomAnswer(pomName, pom.teamName),
    coachQuestion: '감독님은 오늘 경기에서 승부를 가른 준비 요소가 무엇이었다고 보시나요?',
    coachToneOptions: [
      { tone: 'calm', label: '차분하게 답변', answer: buildCoachAnswer(params.userTeamName, params.opponentTeamName, 'calm') },
      { tone: 'confident', label: '자신 있게 답변', answer: buildCoachAnswer(params.userTeamName, params.opponentTeamName, 'confident') },
      { tone: 'reflective', label: '보완점까지 언급', answer: buildCoachAnswer(params.userTeamName, params.opponentTeamName, 'reflective') },
    ],
    fanReaction: `${params.userTeamName} 팬들은 "${pomName}이 오늘 가장 결정적인 순간을 해냈다", "${context.homeNarrative?.broadcastAlias ?? params.userTeamName}의 색이 제대로 살아났다"는 반응을 보내고 있습니다.`,
    socialReaction: `${aftermathHeadline} 이후 커뮤니티에서는 ${context.homeNarrative?.broadcastAlias ?? params.userTeamName}의 서사와 POM 활약, ${context.rivalryContext ? '라이벌전 무게감' : '경기 준비도'}에 대한 반응이 빠르게 쏟아지고 있습니다.`,
    aftermathHeadline,
    guestSummary: buildNarrativeGuestDeskSummary(params.crew.guestAnalyst, context, params.userTeamName, params.opponentTeamName),
    guestAnalystName: params.crew.guestAnalyst?.name ?? null,
  };
}
