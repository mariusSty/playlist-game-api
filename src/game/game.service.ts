import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  AssignSongDto,
  AssignThemeDto,
  CreateGameDto,
} from './dto/create-game.dto';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  async create(createGameDto: CreateGameDto) {
    const game = await this.prisma.game.create({
      data: {
        room: {
          connect: {
            pin: createGameDto.pin,
          },
        },
        round: {
          create: {
            step: {
              connect: {
                id: 1,
              },
            },
            themeMaster: {
              connect: {
                id: createGameDto.userId,
              },
            },
          },
        },
      },
      include: {
        round: true,
      },
    });

    return this.prisma.game.update({
      where: {
        id: game.id,
      },
      data: {
        actualRound: {
          connect: {
            id: game.round[0].id,
          },
        },
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
        actualRound: {
          include: {
            themeMaster: true,
            theme: true,
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

  assignTheme(assignThemeDto: AssignThemeDto) {
    return this.prisma.round.update({
      where: {
        id: assignThemeDto.roundId,
      },
      data: {
        themeId: assignThemeDto.themeId,
      },
      include: {
        theme: true,
      },
    });
  }

  assignSong(assignSongDto: AssignSongDto) {
    return this.prisma.pick.create({
      data: {
        song: {
          create: {
            title: assignSongDto.song.title,
            artist: assignSongDto.song.artist,
            url: assignSongDto.song.url,
          },
        },
        user: {
          connect: {
            id: assignSongDto.userId,
          },
        },
        round: {
          connect: {
            id: assignSongDto.roundId,
          },
        },
      },
    });
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
      include: {
        song: true,
      },
    });
  }
}
