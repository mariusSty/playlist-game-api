import { Injectable } from '@nestjs/common';
import { CreateVoteDto } from 'src/pick/dto/create-vote.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class VoteService {
  constructor(private readonly prisma: PrismaService) {}

  create(createVoteDto: CreateVoteDto) {
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
      include: {
        guessedUser: true,
      },
      cacheStrategy: { swr: 10, ttl: 10 },
    });
  }
}
