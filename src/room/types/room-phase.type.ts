export type RoomPhase =
  | { phase: 'lobby' }
  | { phase: 'playing'; gameId: number };
