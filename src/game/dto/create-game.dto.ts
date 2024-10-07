export class CreateGameDto {
  pin: string;
  userId: string;
}

export class AssignThemeDto {
  roundId: number;
  themeId: number;
}

export class AssignSongDto {
  roundId: number;
  song: {
    title: string;
    artist: string;
    url: string;
  };
  userId: string;
}
