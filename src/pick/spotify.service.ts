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

    const result = await spotifySdk.search(
      search,
      ['track', 'artist', 'album'],
      'FR',
      10,
    );

    return result;
  }
}
