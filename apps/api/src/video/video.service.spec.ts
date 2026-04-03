import { Test, TestingModule } from '@nestjs/testing';
import { VideoService } from './video.service';
import { ConfigService } from '@nestjs/config';

// Mock AccessToken to avoid needing actual API keys and for predictable output
jest.mock('livekit-server-sdk', () => {
  return {
    AccessToken: jest.fn().mockImplementation(() => {
      return {
        addGrant: jest.fn(),
        toJwt: jest.fn().mockResolvedValue('mocked-jwt-token'),
      };
    }),
  };
});

import { AccessToken } from 'livekit-server-sdk';

describe('VideoService', () => {
  let service: VideoService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'LIVEKIT_API_KEY') return 'test_api_key';
              if (key === 'LIVEKIT_API_SECRET') return 'test_api_secret';
              if (key === 'LIVEKIT_WS_URL') return 'ws://test-livekit.local';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<VideoService>(VideoService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateToken', () => {
    it('should generate a LiveKit token with correct grants', async () => {
      const roomName = 'room-123';
      const identity = 'test-user@example.com';

      const result = await service.generateToken(roomName, identity);

      expect(configService.get).toHaveBeenCalledWith('LIVEKIT_API_KEY');
      expect(configService.get).toHaveBeenCalledWith('LIVEKIT_API_SECRET');
      expect(configService.get).toHaveBeenCalledWith('LIVEKIT_WS_URL');

      // Verify AccessToken constructor was called correctly
      expect(AccessToken).toHaveBeenCalledWith('test_api_key', 'test_api_secret', {
        identity,
      });

      // Verify grant and token return
      const mockAccessTokenInstance = (AccessToken as jest.Mock).mock.results[0].value;
      expect(mockAccessTokenInstance.addGrant).toHaveBeenCalledWith({
        roomJoin: true,
        room: roomName,
      });
      expect(mockAccessTokenInstance.toJwt).toHaveBeenCalled();

      expect(result).toEqual({
        token: 'mocked-jwt-token',
        roomName,
        livekitUrl: 'ws://test-livekit.local',
      });
    });

    it('deve lançar se LIVEKIT_API_KEY ou LIVEKIT_API_SECRET não estiverem definidos', async () => {
      const moduleNoKeys = await Test.createTestingModule({
        providers: [
          VideoService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(undefined),
            },
          },
        ],
      }).compile();

      const svc = moduleNoKeys.get<VideoService>(VideoService);
      await expect(svc.generateToken('room-x', 'user@x.com')).rejects.toThrow(
        /LIVEKIT_API_KEY e LIVEKIT_API_SECRET/,
      );
    });
  });
});
