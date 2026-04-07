import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';

@Injectable()
export class VideoService {
  constructor(private readonly config: ConfigService) {}

  async generateToken(roomName: string, identity: string) {
    const apiKey = this.config.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.config.get<string>('LIVEKIT_API_SECRET');
    const livekitUrl = this.config.get<string>('LIVEKIT_WS_URL') ?? 'ws://localhost:7880';

    if (!apiKey || !apiSecret) {
      throw new Error('LIVEKIT_API_KEY e LIVEKIT_API_SECRET devem estar configurados');
    }

    const at = new AccessToken(apiKey, apiSecret, { identity });
    at.addGrant({ roomJoin: true, room: roomName });
    const token = await at.toJwt();

    return {
      token,
      roomName,
      livekitUrl,
    };
  }
}
