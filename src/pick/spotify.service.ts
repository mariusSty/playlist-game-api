import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';

@Injectable()
export class SpotifyService {
  constructor(private readonly configService: ConfigService) {}

  async search(search: string) {
    const spotifySdk = SpotifyApi.withClientCredentials(
      this.configService.get('SPOTIFY_CLIENT_ID'),
      this.configService.get('SPOTIFY_CLIENT_SECRET'),
    );

    const result = await spotifySdk.search(search, ['track'], 'FR', 5);

    return result.tracks.items.map((item) => ({
      id: item.id,
      title: item.name,
      artist: item.artists.map((artist) => artist.name),
    }));
  }
}
