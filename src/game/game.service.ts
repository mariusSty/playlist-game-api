import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  create(createGameDto: CreateGameDto) {
    return this.prisma.game.create({
      data: {
        room: {
          connect: {
            pin: createGameDto.pin,
          },
        },
        round: {
          create: {
            stepId: 1,
          },
        },
      },
    });
  }
}
