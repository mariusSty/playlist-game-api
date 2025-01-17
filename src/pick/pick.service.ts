import { Injectable } from '@nestjs/common';
import { AssignSongDto } from 'src/pick/dto/assign-song.dto';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class PickService {
  constructor(private readonly prisma: PrismaService) {}

  assignTrack(assignSongDto: AssignSongDto) {
    return this.prisma.pick.upsert({
      where: {
        roundId_userId: {
          roundId: Number(assignSongDto.roundId),
          userId: assignSongDto.userId,
        },
      },
      update: {
        track: {
          connectOrCreate: {
            where: {
              id: assignSongDto.track.id,
            },
            create: {
              id: assignSongDto.track.id,
              title: assignSongDto.track.title,
              artist: assignSongDto.track.artist,
              previewUrl: assignSongDto.track.previewUrl,
            },
          },
        },
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
        track: {
          connectOrCreate: {
            where: {
              id: assignSongDto.track.id,
            },
            create: {
              id: assignSongDto.track.id,
              title: assignSongDto.track.title,
              artist: assignSongDto.track.artist,
              previewUrl: assignSongDto.track.previewUrl,
            },
          },
        },
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
      include: {
        track: true,
      },
    });
  }

  remove(roundId: number, userId: string) {
    return this.prisma.pick.delete({
      where: {
        roundId_userId: {
          roundId,
          userId,
        },
      },
    });
  }
}
