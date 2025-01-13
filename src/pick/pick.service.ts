import { Injectable } from '@nestjs/common';
import { AssignSongDto } from 'src/pick/dto/assign-song.dto';
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

  countByRoundId(roundId: number) {
    return this.prisma.pick.count({
      where: {
        roundId: Number(roundId),
      },
    });
  }

  getFirstWithoutVotes(pin: string) {
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

  getById(id: number) {
    return this.prisma.pick.findUnique({
      where: {
        id,
      },
    });
  }
}
