import { Injectable } from '@nestjs/common';
import twilio from 'twilio';

@Injectable()
export class VideoService {
  async generateToken(roomName: string, identity: string) {
    const AccessToken = twilio.jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;

    const token = new AccessToken(
      'AC_MOCK_ACCOUNT_SID',
      'SK_MOCK_API_KEY',
      'MOCK_API_SECRET',
      { identity }
    );

    const videoGrant = new VideoGrant({ room: roomName });
    token.addGrant(videoGrant);

    return {
      token: token.toJwt(),
      roomName,
    };
  }
}
