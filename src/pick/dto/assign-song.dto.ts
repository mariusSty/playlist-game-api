export class AssignSongDto {
  roundId: number;
  track: {
    id: string;
    title: string;
    artists: string;
  };
  userId: string;
}
