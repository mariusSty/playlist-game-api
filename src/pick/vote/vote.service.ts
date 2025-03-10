import { Injectable } from '@nestjs/common';
import { CreateVoteDto } from 'src/pick/dto/create-vote.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class VoteService {
  constructor(private readonly prisma: PrismaService) {}

  create(createVoteDto: CreateVoteDto) {
    return this.prisma.vote.create({
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
    return this.prisma.vote.delete({
      where: {
        pickId_guessUserId: {
          pickId,
          guessUserId: userId,
        },
      },
    });
  }

  getByPickId(pickId: number) {
    return this.prisma.vote.findMany({
      where: {
        pickId,
      },
      include: {
        guessedUser: true,
      },
    });
  }
}
