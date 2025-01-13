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

  countByPickId(pickId: number) {
    return this.prisma.vote.count({
      where: {
        pickId,
      },
    });
  }
}
