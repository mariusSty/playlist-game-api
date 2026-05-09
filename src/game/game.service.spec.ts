import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma.service';
import { GameService } from './game.service';

type FakeUser = { id: string; name: string };
type FakeVote = { guessUserId: string; guessedUserId: string };
type FakePick = { userId: string; votes: FakeVote[] };
type FakeRound = { id: number; picks: FakePick[]; themeMaster?: FakeUser };
type FakeGame = { id: number; users: FakeUser[]; rounds: FakeRound[] };

const makeUsers = (ids: string[]): FakeUser[] =>
  ids.map((id) => ({ id, name: id.toUpperCase() }));

/**
 * Build a round where `correctVotesByPicker[pickerId]` lists the userIds
 * that voted correctly for that pick. Each correct vote = +1 point for voter.
 */
const buildRound = (
  id: number,
  correctVotesByPicker: Record<string, string[]>,
): FakeRound => ({
  id,
  picks: Object.entries(correctVotesByPicker).map(([pickerId, voters]) => ({
    userId: pickerId,
    votes: voters.map((voterId) => ({
      guessUserId: voterId,
      guessedUserId: pickerId,
    })),
  })),
});

describe('GameService', () => {
  let service: GameService;
  let findFirstOrThrow: jest.Mock;

  beforeEach(async () => {
    findFirstOrThrow = jest.fn();
    const prismaMock = {
      client: {
        game: { findFirstOrThrow },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateResults', () => {
    /**
     * Build a game whose totals match `targetScores` (one round per scorer
     * giving the requested points). Users get an id like "u1", "u2", ...
     */
    const gameWithTotals = (targetScores: number[]): FakeGame => {
      const users = makeUsers(targetScores.map((_, i) => `u${i + 1}`));
      const rounds: FakeRound[] = users.map((user, i) => ({
        id: i + 1,
        picks: [
          {
            userId: user.id,
            votes: Array.from({ length: targetScores[i] }, (_, k) => ({
              guessUserId: user.id,
              guessedUserId: user.id,
              _k: k,
            })) as FakeVote[],
          },
        ],
      }));
      return { id: 1, users, rounds };
    };

    it('assigns sequential places when there are no ties', () => {
      const game = gameWithTotals([3, 2, 1]);
      const result = service.calculateResults(game as any);
      expect(result.map((r) => [r.user.id, r.score, r.place])).toEqual([
        ['u1', 3, 1],
        ['u2', 2, 2],
        ['u3', 1, 3],
      ]);
    });

    it('shares the top place among tied leaders and skips the next place', () => {
      const game = gameWithTotals([3, 3, 1]);
      const result = service.calculateResults(game as any);
      expect(result.map((r) => [r.user.id, r.score, r.place])).toEqual([
        ['u1', 3, 1],
        ['u2', 3, 1],
        ['u3', 1, 3],
      ]);
    });

    it('handles a tie in the middle of the standings', () => {
      const game = gameWithTotals([3, 2, 2, 1]);
      const result = service.calculateResults(game as any);
      expect(result.map((r) => [r.user.id, r.score, r.place])).toEqual([
        ['u1', 3, 1],
        ['u2', 2, 2],
        ['u3', 2, 2],
        ['u4', 1, 4],
      ]);
    });

    it('handles successive groups of ties (1, 1, 3, 3)', () => {
      const game = gameWithTotals([3, 3, 1, 1]);
      const result = service.calculateResults(game as any);
      expect(result.map((r) => [r.user.id, r.score, r.place])).toEqual([
        ['u1', 3, 1],
        ['u2', 3, 1],
        ['u3', 1, 3],
        ['u4', 1, 3],
      ]);
    });

    it('places everyone first when nobody has scored', () => {
      const game = gameWithTotals([0, 0, 0]);
      const result = service.calculateResults(game as any);
      expect(result.every((r) => r.place === 1)).toBe(true);
      expect(result.every((r) => r.score === 0)).toBe(true);
    });
  });

  describe('getStandings', () => {
    const setupGame = (game: FakeGame) => {
      findFirstOrThrow.mockResolvedValue(game);
    };

    it('throws when the round does not belong to the game', async () => {
      setupGame({
        id: 1,
        users: makeUsers(['a', 'b']),
        rounds: [buildRound(10, {})],
      });
      await expect(service.getStandings(1, 999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns previousPlace null on the first round', async () => {
      // Round 10: a scores 2, b scores 1, c scores 0
      setupGame({
        id: 1,
        users: makeUsers(['a', 'b', 'c']),
        rounds: [
          buildRound(10, {
            a: ['a', 'a'], // a guesses own pick twice → 2 pts to a
            b: ['b'], // b → 1 pt to b
          }),
        ],
      });

      const standings = await service.getStandings(1, 10);
      expect(
        standings.map((s) => [
          s.user.id,
          s.totalScore,
          s.roundScore,
          s.place,
          s.previousPlace,
        ]),
      ).toEqual([
        ['a', 2, 2, 1, null],
        ['b', 1, 1, 2, null],
        ['c', 0, 0, 3, null],
      ]);
    });

    it('uses 1224 ranking for both place and previousPlace', async () => {
      // After round 10: a=2, b=1, c=1, d=0  → places 1, 2, 2, 4
      // After round 20 (current): a=2 (+0), b=2 (+1), c=1 (+0), d=2 (+2)
      //   totals = [2, 2, 1, 2] → ranked desc 2,2,2,1 → places 1,1,1,4
      setupGame({
        id: 1,
        users: makeUsers(['a', 'b', 'c', 'd']),
        rounds: [
          buildRound(10, {
            a: ['a', 'a'], // a +2
            b: ['b'], // b +1
            c: ['c'], // c +1
          }),
          buildRound(20, {
            b: ['b'], // b +1
            d: ['d', 'd'], // d +2
          }),
        ],
      });

      const standings = await service.getStandings(1, 20);
      const byUser = Object.fromEntries(standings.map((s) => [s.user.id, s]));

      expect(byUser.a.totalScore).toBe(2);
      expect(byUser.b.totalScore).toBe(2);
      expect(byUser.c.totalScore).toBe(1);
      expect(byUser.d.totalScore).toBe(2);

      expect(byUser.a.roundScore).toBe(0);
      expect(byUser.b.roundScore).toBe(1);
      expect(byUser.c.roundScore).toBe(0);
      expect(byUser.d.roundScore).toBe(2);

      // Current places (totals 2,2,1,2 → 1,1,4,1)
      expect(byUser.a.place).toBe(1);
      expect(byUser.b.place).toBe(1);
      expect(byUser.d.place).toBe(1);
      expect(byUser.c.place).toBe(4);

      // Previous places (totals after round 10: 2,1,1,0 → 1,2,2,4)
      expect(byUser.a.previousPlace).toBe(1);
      expect(byUser.b.previousPlace).toBe(2);
      expect(byUser.c.previousPlace).toBe(2);
      expect(byUser.d.previousPlace).toBe(4);
    });

    it('sorts the response by place ascending', async () => {
      setupGame({
        id: 1,
        users: makeUsers(['z', 'a', 'm']),
        rounds: [
          buildRound(10, {
            a: ['a', 'a', 'a'], // a +3
            m: ['m'], // m +1
          }),
        ],
      });

      const standings = await service.getStandings(1, 10);
      expect(standings.map((s) => s.user.id)).toEqual(['a', 'm', 'z']);
      expect(standings.map((s) => s.place)).toEqual([1, 2, 3]);
    });

    it('handles successive ties in the standings', async () => {
      // a=3, b=3, c=1, d=1 → places 1, 1, 3, 3
      setupGame({
        id: 1,
        users: makeUsers(['a', 'b', 'c', 'd']),
        rounds: [
          buildRound(10, {
            a: ['a', 'a', 'a'],
            b: ['b', 'b', 'b'],
            c: ['c'],
            d: ['d'],
          }),
        ],
      });

      const standings = await service.getStandings(1, 10);
      const placeById = Object.fromEntries(
        standings.map((s) => [s.user.id, s.place]),
      );
      expect(placeById).toEqual({ a: 1, b: 1, c: 3, d: 3 });
    });
  });
});
