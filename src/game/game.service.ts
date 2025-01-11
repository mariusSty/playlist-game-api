import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { AssignSongDto } from './dto/create-game.dto';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  create(pin: string, userIds: string[]) {
    return this.prisma.game.create({
      data: {
        room: {
          connect: {
            pin,
          },
        },
        rounds: {
          create: userIds.map((userId) => ({
            themeMasterId: userId,
            theme: '',
          })),
        },
      },
      include: {
        rounds: true,
      },
    });
  }

  findOne(pin: string) {
    return this.prisma.game.findFirstOrThrow({
      where: {
        room: {
          pin,
        },
      },
      include: {
        rounds: {
          include: {
            themeMaster: true,
          },
        },
      },
    });
  }

  getRound(id: number) {
    return this.prisma.round.findUnique({
      where: {
        id,
      },
      include: {
        game: {
          include: {
            room: {
              include: {
                users: true,
              },
            },
          },
        },
      },
    });
  }

  updateRound(id: number, theme: string) {
    return this.prisma.round.update({
      where: {
        id,
      },
      data: {
        theme,
      },
    });
  }

  assignSong(assignSongDto: AssignSongDto) {
    return this.prisma.pick.upsert({
      where: {
        roundId_userId: {
          roundId: Number(assignSongDto.roundId),
          userId: assignSongDto.userId,
        },
      },
      update: {
        song: assignSongDto.song,
      },
      create: {
        user: {
          connect: {
            id: assignSongDto.userId,
          },
        },
        round: {
          connect: {
            id: Number(assignSongDto.roundId),
          },
        },
        song: assignSongDto.song,
      },
    });
  }

  countPicksByRoundId(roundId: number) {
    return this.prisma.pick.count({
      where: {
        roundId: Number(roundId),
      },
    });
  }

  getPickWithoutVotes(pin: string) {
    return this.prisma.pick.findFirst({
      where: {
        round: {
          game: {
            room: {
              pin,
            },
          },
        },
        votes: {
          none: {},
        },
      },
    });
  }

  createVote(data: { pickId: string; guessId: string; userId: string }) {
    return this.prisma.vote.create({
      data: {
        pick: {
          connect: {
            id: Number(data.pickId),
          },
        },
        guessedUser: {
          connect: {
            id: data.guessId,
          },
        },
        guessUser: {
          connect: {
            id: data.userId,
          },
        },
      },
    });
  }
}
