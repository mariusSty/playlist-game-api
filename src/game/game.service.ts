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
    console.log(assignSongDto);
    // return this.prisma.pick.upsert({
    //   where: {
    //     roundId_userId: {
    //       roundId: assignSongDto.roundId,
    //       userId: assignSongDto.userId,
    //     },
    //   },
    //   update: {
    //     song: {
    //       update: {
    //         title: assignSongDto.song.title,
    //         artist: assignSongDto.song.artist,
    //         url: assignSongDto.song.url,
    //       },
    //     },
    //   },
    //   create: {
    //     user: {
    //       connect: {
    //         id: assignSongDto.userId,
    //       },
    //     },
    //     round: {
    //       connect: {
    //         id: assignSongDto.roundId,
    //       },
    //     },
    //     song: {
    //       create: {
    //         title: assignSongDto.song.title,
    //         artist: assignSongDto.song.artist,
    //         url: assignSongDto.song.url,
    //       },
    //     },
    //   },
    // });
  }

  countUsersValidatedSong(roundId: number) {
    return this.prisma.pick.count({
      where: {
        roundId,
      },
    });
  }

  getPicks(pin: string) {
    return this.prisma.pick.findMany({
      where: {
        round: {
          game: {
            room: {
              pin,
            },
          },
        },
      },
    });
  }

  createVote(pickId: number, guessedUserId: string, guessUserId: string) {
    return this.prisma.vote.create({
      data: {
        pick: {
          connect: {
            id: pickId,
          },
        },
        guessedUser: {
          connect: {
            id: guessedUserId,
          },
        },
        guessUser: {
          connect: {
            id: guessUserId,
          },
        },
      },
    });
  }
}
