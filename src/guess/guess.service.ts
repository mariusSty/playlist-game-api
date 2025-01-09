import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class GuessService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { guessId: string; userId: string; voteId: number }) {
    return this.prisma.guess.create({
      data: {
        guessedUser: {
          connect: {
            id: data.userId,
          },
        },
        guessUser: {
          connect: {
            id: data.guessId,
          },
        },
        vote: {
          connect: {
            id: data.voteId,
          },
        },
      },
    });
  }

  async countByVoteId(voteId: number) {
    return this.prisma.guess.count({
      where: { vote: { id: voteId } },
    });
  }
}
