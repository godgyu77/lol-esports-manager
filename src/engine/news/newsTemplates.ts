export const MATCH_RESULT_NEWS_TEMPLATES = {
  titles: [
    '{winner} defeat {loser} {winScore}:{loseScore}',
    '{winner} take down {loser} {winScore}:{loseScore}',
    '{loser} fall to {winner} {loseScore}:{winScore}',
  ],
  contents: [
    'On {date}, {winner} beat {loser} by {winScore}:{loseScore}.',
    '{winner} controlled the match and closed out {loser} {winScore}:{loseScore}.',
    '{loser} could not stop {winner}, who won {winScore}:{loseScore}.',
  ],
};

export const TRANSFER_RUMOR_NEWS_TEMPLATES = {
  titles: [
    "{teamName} linked with '{playerName}'",
    "'{playerName}' rumored to be on {teamName}'s radar",
    "{teamName} expected to explore a move for {playerName}",
  ],
  contents: [
    '{teamName} are reportedly reviewing a move for {playerName}.',
    '{playerName} has emerged as a possible target for {teamName}.',
    'Industry sources suggest {teamName} and {playerName} have been connected in early talks.',
  ],
};

export const TEAM_ANALYSIS_NEWS_TEMPLATES = {
  strong: [
    {
      title: '[Analysis] {teamName} hold firm at {standing}',
      content: '{teamName} are {wins}-{losses} with a {winRate}% win rate and continue to look like a top contender.',
    },
    {
      title: '[Analysis] {teamName} continue strong run',
      content: '{teamName} keep momentum with a {wins}-{losses} record and balanced form across the roster.',
    },
  ],
  weak: [
    {
      title: '[Analysis] {teamName} still searching for answers',
      content: '{teamName} sit at {wins}-{losses} with a {winRate}% win rate and remain under pressure to improve.',
    },
    {
      title: '[Analysis] {teamName} need a turnaround',
      content: '{teamName} have slipped to {standing} and must address their inconsistency quickly.',
    },
  ],
  mid: [
    {
      title: '[Analysis] {teamName} remain in the middle pack',
      content: '{teamName} are {wins}-{losses} with a {winRate}% win rate and still have room to push upward.',
    },
    {
      title: '[Analysis] {teamName} still in the race',
      content: '{teamName} remain competitive at {standing}, but need stronger finishing to climb higher.',
    },
  ],
};
