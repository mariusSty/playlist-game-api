export class AssignSongDto {
  roundId: number;
  track: {
    id: string;
    title: string;
    artist: string;
    previewUrl: string;
  };
  userId: string;
}
