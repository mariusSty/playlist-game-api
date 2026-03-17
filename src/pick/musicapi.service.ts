import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

@Injectable()
export class MusicApiService {
  async search(search: string) {
    Sentry.logger.info('Song search started', { query: search });
    const result = await fetch(
      `https://api.deezer.com/search?q=${search}&index=0&limit=10`,
    );

    const response = await result.json();

    const data = response.data?.map((item) => ({
      id: item.id.toString(),
      title: item.title,
      artist: item.artist.name,
      album: item.album.title,
      cover: item.album.cover_medium,
      previewUrl: item.preview,
    })) ?? [];

    Sentry.logger.info('Song search completed', { query: search, resultCount: data.length });
    return data;
  }
}
