import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { AssignThemeDto, CreateGameDto } from './dto/create-game.dto';

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

  findOne(id: number) {
    return this.prisma.game.findFirstOrThrow({
      where: { id },
      include: {
        actualRound: {
          include: {
            themeMaster: true,
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
    });
  }
}
