import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { CreateVoteDto } from 'src/pick/dto/create-vote.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class VoteService {
  constructor(private readonly prisma: PrismaService) {}

  create(createVoteDto: CreateVoteDto) {
    Sentry.logger.info('Vote cast', {
      pickId: createVoteDto.pickId,
      voterId: createVoteDto.userId,
      guessedUserId: createVoteDto.guessId,
    });
    return this.prisma.client.vote.create({
      data: {
        pick: {
          connect: {
            id: Number(createVoteDto.pickId),
          },
        },
        guessedUser: {
          connect: {
            id: createVoteDto.guessId,
          },
        },
        guessUser: {
          connect: {
            id: createVoteDto.userId,
          },
        },
      },
    });
  }

  remove(pickId: number, userId: string) {
    Sentry.logger.info('Vote cancelled', { pickId, userId });
    return this.prisma.client.vote.delete({
      where: {
        pickId_guessUserId: {
          pickId,
          guessUserId: userId,
        },
      },
    });
  }

  getByPickId(pickId: number) {
    return this.prisma.client.vote.findMany({
      where: {
        pickId,
      },
    });
  }
}
