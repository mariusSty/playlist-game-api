export type UserSession =
  | { phase: 'home' }
  | { phase: 'lobby'; pin: string }
  | { phase: 'theme'; pin: string; gameId: number; roundId: number }
  | { phase: 'song'; pin: string; gameId: number; roundId: number }
  | {
      phase: 'vote';
      pin: string;
      gameId: number;
      roundId: number;
      pickId: number;
    }
  | { phase: 'reveal'; pin: string; gameId: number; roundId: number }
  | { phase: 'result'; pin: string; gameId: number };
