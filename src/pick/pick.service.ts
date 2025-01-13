import { Injectable } from '@nestjs/common';
import { AssignSongDto } from 'src/pick/dto/assign-song.dto';
import { CreateVoteDto } from 'src/pick/dto/create-vote.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class PickService {
  constructor(private readonly prisma: PrismaService) {}

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

  getPickById(id: number) {
    return this.prisma.pick.findUnique({
      where: {
        id,
      },
    });
  }

  createVote(createVoteDto: CreateVoteDto) {
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

  countVotesByPickId(pickId: number) {
    return this.prisma.vote.count({
      where: {
        pickId,
      },
    });
  }
}
