import { Injectable } from '@nestjs/common';

@Injectable()
export class MusicApiService {
  async search(search: string) {
    const result = await fetch(
      `https://api.deezer.com/search?q=${search}&index=0&limit=10`,
    );

    const response = await result.json();

    return response.data.map((item) => ({
      id: item.id.toString(),
      title: item.title,
      artist: item.artist.name,
      previewUrl: item.preview,
    }));
  }
}
