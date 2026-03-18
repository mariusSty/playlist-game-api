export type GamePhase =
  | { phase: 'theme'; roundId: number }
  | { phase: 'song'; roundId: number }
  | { phase: 'vote'; roundId: number; pickId: number }
  | { phase: 'reveal'; roundId: number }
  | { phase: 'result' };
