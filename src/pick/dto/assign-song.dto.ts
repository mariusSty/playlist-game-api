export class AssignSongDto {
  roundId: number;
  track: {
    id: string;
    title: string;
    artist: string;
    album: string;
    cover: string;
    previewUrl: string;
  };
  userId: string;
}
